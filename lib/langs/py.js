module.exports =
`from __future__ import absolute_import, division, print_function, with_statement

import socket

from tornado.escape import native_str
from tornado.http1connection import HTTP1ServerConnection, HTTP1ConnectionParameters
from tornado import gen
from tornado import httputil
from tornado import iostream
from tornado import netutil
from tornado.tcpserver import TCPServer
from tornado.util import Configurable


class HTTPServer(TCPServer, Configurable,
                 httputil.HTTPServerConnectionDelegate):

    def __init__(self, *args, **kwargs):
        pass

    def initialize(self, request_callback, no_keep_alive=False, io_loop=None,
                   xheaders=False, ssl_options=None, protocol=None,
                   decompress_request=False,
                   chunk_size=None, max_header_size=None,
                   idle_connection_timeout=None, body_timeout=None,
                   max_body_size=None, max_buffer_size=None):
        self.request_callback = request_callback
        self.no_keep_alive = no_keep_alive
        self.xheaders = xheaders
        self.protocol = protocol
        self.conn_params = HTTP1ConnectionParameters(
            decompress=decompress_request,
            chunk_size=chunk_size,
            max_header_size=max_header_size,
            header_timeout=idle_connection_timeout or 3600,
            max_body_size=max_body_size,
            body_timeout=body_timeout)
        TCPServer.__init__(self, io_loop=io_loop, ssl_options=ssl_options,
                           max_buffer_size=max_buffer_size,
                           read_chunk_size=chunk_size)
        self._connections = set()

    @classmethod
    def configurable_base(cls):
        return HTTPServer

    @classmethod
    def configurable_default(cls):
        return HTTPServer

    @gen.coroutine
    def close_all_connections(self):
        while self._connections:
            # Peek at an arbitrary element of the set
            conn = next(iter(self._connections))
            yield conn.close()

    def handle_stream(self, stream, address):
        context = _HTTPRequestContext(stream, address,
                                      self.protocol)
        conn = HTTP1ServerConnection(
            stream, self.conn_params, context)
        self._connections.add(conn)
        conn.start_serving(self)

    def start_request(self, server_conn, request_conn):
        if isinstance(self.request_callback, httputil.HTTPServerConnectionDelegate):
            delegate = self.request_callback.start_request(server_conn, request_conn)
        else:
            delegate = _CallableAdapter(self.request_callback, request_conn)

        if self.xheaders:
            delegate = _ProxyAdapter(delegate, request_conn)

        return delegate

    def on_close(self, server_conn):
        self._connections.remove(server_conn)


class _CallableAdapter(httputil.HTTPMessageDelegate):
    def __init__(self, request_callback, request_conn):
        self.connection = request_conn
        self.request_callback = request_callback
        self.request = None
        self.delegate = None
        self._chunks = []

    def headers_received(self, start_line, headers):
        self.request = httputil.HTTPServerRequest(
            connection=self.connection, start_line=start_line,
            headers=headers)

    def data_received(self, chunk):
        self._chunks.append(chunk)

    def finish(self):
        self.request.body = b''.join(self._chunks)
        self.request._parse_body()
        self.request_callback(self.request)

    def on_connection_close(self):
        self._chunks = None


class _HTTPRequestContext(object):
    def __init__(self, stream, address, protocol):
        self.address = address
        # Save the socket's address family now so we know how to
        # interpret self.address even after the stream is closed
        # and its socket attribute replaced with None.
        if stream.socket is not None:
            self.address_family = stream.socket.family
        else:
            self.address_family = None
        # In HTTPServerRequest we want an IP, not a full socket address.
        if (self.address_family in (socket.AF_INET, socket.AF_INET6) and
                address is not None):
            self.remote_ip = address[0]
        else:
            # Unix (or other) socket; fake the remote address.
            self.remote_ip = '0.0.0.0'
        if protocol:
            self.protocol = protocol
        elif isinstance(stream, iostream.SSLIOStream):
            self.protocol = "https"
        else:
            self.protocol = "http"
        self._orig_remote_ip = self.remote_ip
        self._orig_protocol = self.protocol

    def __str__(self):
        if self.address_family in (socket.AF_INET, socket.AF_INET6):
            return self.remote_ip
        elif isinstance(self.address, bytes):
            # Python 3 with the -bb option warns about str(bytes),
            # so convert it explicitly.
            # Unix socket addresses are str on mac but bytes on linux.
            return native_str(self.address)
        else:
            return str(self.address)

    def _apply_xheaders(self, headers):
        """Rewrite the ''remote_ip'' and ''protocol'' fields."""
        # Squid uses X-Forwarded-For, others use X-Real-Ip
        ip = headers.get("X-Forwarded-For", self.remote_ip)
        ip = ip.split(',')[-1].strip()
        ip = headers.get("X-Real-Ip", ip)
        if netutil.is_valid_ip(ip):
            self.remote_ip = ip
        # AWS uses X-Forwarded-Proto
        proto_header = headers.get(
            "X-Scheme", headers.get("X-Forwarded-Proto",
                                    self.protocol))
        if proto_header in ("http", "https"):
            self.protocol = proto_header

    def _unapply_xheaders(self):
        """Undo changes from '_apply_xheaders'.

        Xheaders are per-request so they should not leak to the next
        request on the same connection.
        """
        self.remote_ip = self._orig_remote_ip
        self.protocol = self._orig_protocol


class _ProxyAdapter(httputil.HTTPMessageDelegate):
    def __init__(self, delegate, request_conn):
        self.connection = request_conn
        self.delegate = delegate

    def headers_received(self, start_line, headers):
        self.connection.context._apply_xheaders(headers)
        return self.delegate.headers_received(start_line, headers)

    def data_received(self, chunk):
        return self.delegate.data_received(chunk)

    def finish(self):
        self.delegate.finish()
        self._cleanup()

    def on_connection_close(self):
        self.delegate.on_connection_close()
        self._cleanup()

    def _cleanup(self):
        self.connection.context._unapply_xheaders()

HTTPRequest = httputil.HTTPServerRequest
`
