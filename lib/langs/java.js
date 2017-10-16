module.exports =
`package application;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

}

@RestController
@RequestMapping("/customer")
class CustomerController {

    @Autowired
    private CustomerServiceImpl customerService;

    @GetMapping(value = "/{firstName}")
    public Customer getCustomerByFirstName(@PathVariable(value = "firstName") String firstName) {
        return customerService.findByFirstName(firstName);
    }

    @PostMapping
    public Customer saveCustomer(@RequestBody Customer customer) {
        return customerService.save(customer);
    }

}

@Service
class CustomerServiceImpl implements ICustomerService {

    @Autowired
    private CustomerRepository repository;

    @Override
    public Customer findByFirstName(String firstName) {
        return repository.findByFirstName(firstName);
    }

    @Override
    public Customer save(Customer customer) {
        return repository.save(customer);
    }

}

interface ICustomerService{

    public Customer findByFirstName(String firstName);

    public Customer save(Customer customer);
}

interface CustomerRepository extends MongoRepository<Customer, String> {

    public Customer findByFirstName(String firstName);

}

class Customer {

    @Id
    public String id;

    private String firstName;
    private String lastName;

    public Customer() {
    }

    public Customer(String firstName, String lastName) {
        this.firstName = firstName;
        this.lastName = lastName;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    @Override
    public String toString() {
        return String.format(
                "Customer[id=%s, firstName='%s', lastName='%s']",
                id, firstName, lastName);
    }

}
`;
