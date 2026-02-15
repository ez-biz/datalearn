
export const ECOMMERCE_SCHEMA = `
CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    name VARCHAR,
    email VARCHAR,
    country VARCHAR
);

CREATE TABLE products (
    product_id INTEGER PRIMARY KEY,
    name VARCHAR,
    category VARCHAR,
    price DECIMAL
);

CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    order_date DATE,
    total_amount DECIMAL
);

CREATE TABLE order_items (
    item_id INTEGER PRIMARY KEY,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    unit_price DECIMAL
);

INSERT INTO customers VALUES 
(1, 'John Doe', 'john@example.com', 'USA'),
(2, 'Jane Smith', 'jane@example.com', 'Canada'),
(3, 'Alice Johnson', 'alice@example.com', 'UK'),
(4, 'Bob Brown', 'bob@example.com', 'USA');

INSERT INTO products VALUES 
(101, 'Laptop', 'Electronics', 1200.00),
(102, 'Smartphone', 'Electronics', 800.00),
(103, 'Desk Chair', 'Furniture', 150.00),
(104, 'Coffee Table', 'Furniture', 200.00),
(105, 'Headphones', 'Electronics', 100.00);

INSERT INTO orders VALUES 
(1001, 1, '2023-01-15', 1350.00),
(1002, 2, '2023-01-16', 800.00),
(1003, 1, '2023-02-10', 100.00),
(1004, 3, '2023-02-20', 1350.00);

INSERT INTO order_items VALUES 
(1, 1001, 101, 1, 1200.00),
(2, 1001, 103, 1, 150.00),
(3, 1002, 102, 1, 800.00),
(4, 1003, 105, 1, 100.00),
(5, 1004, 101, 1, 1200.00),
(6, 1004, 103, 1, 150.00);
`
