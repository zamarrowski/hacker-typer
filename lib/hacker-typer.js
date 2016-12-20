'use babel'

import HackerTyperView from './hacker-typer-view'
import { CompositeDisposable } from 'atom'

export default {

  hackerTyperView: null,
  modalPanel: null,
  subscriptions: null,
  isVisible: false,
  letterCount: 3,

  activate(state) {
    this.hackerTyperView = new HackerTyperView(state.hackerTyperViewState)
    this.isVisible = true
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable()

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'hacker-typer:toggle': () => this.listenKeyboard(),
      'hacker-typer:end': () => this.activateListener()
    }))
  },

  deactivate() {
    this.isVisible = false
    this.subscriptions.dispose()
    this.hackerTyperView.destroy()
  },

  serialize() {
    return {
      hackerTyperViewState: this.hackerTyperView.serialize()
    }
  },

  listenKeyboard() {
    console.log('HackerTyper was toggled !!!!')
    let editor = atom.workspace.getActiveTextEditor()
    if (editor) {
      editorView = atom.views.getView(editor)
      language = this.getLanguage(editor)
      template = this.getTemplate(language)
      editorView.addEventListener('keydown', () => {
        if (this.isVisible) {
          setTimeout(() => {
            let text = template.substr(0, this.letterCount)
            this.letterCount += 3
            editor.setText(text)
          })
        }
      })
    }
  },

  getLanguage(editor) {
    let fileName = editor.getTitle()
    let extension = fileName.substr(fileName.lastIndexOf('.') + 1)
    if (extension != 'py' && extension != 'js') return 'js'
    return extension
  },

  getTemplate(language) {
    return require('./langs/' + language + '.js')
  },

  activateListener() {
    this.isVisible = !this.isVisible
  }

}
