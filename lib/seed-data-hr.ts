export const HR_SCHEMA = `
CREATE TABLE departments (
    id INTEGER,
    name VARCHAR
);

CREATE TABLE employees (
    id INTEGER,
    name VARCHAR,
    department_id INTEGER,
    hire_date DATE
);

CREATE TABLE salaries (
    employee_id INTEGER,
    amount DOUBLE PRECISION
);

INSERT INTO departments VALUES (1, 'Engineering');
INSERT INTO departments VALUES (2, 'Sales');
INSERT INTO departments VALUES (3, 'Marketing');

INSERT INTO employees VALUES (1, 'Alice', 1, '2025-06-01');
INSERT INTO employees VALUES (2, 'Bob', 1, '2023-03-15');
INSERT INTO employees VALUES (3, 'Charlie', 2, '2025-11-10');
INSERT INTO employees VALUES (4, 'Diana', 2, '2022-08-20');
INSERT INTO employees VALUES (5, 'Eve', 3, '2025-01-05');
INSERT INTO employees VALUES (6, 'Frank', 1, '2024-09-15');
INSERT INTO employees VALUES (7, 'Grace', 2, '2024-02-01');
INSERT INTO employees VALUES (8, 'Henry', 3, '2023-12-10');
INSERT INTO employees VALUES (9, 'Ian', 1, '2024-05-20');

INSERT INTO salaries VALUES (1, 95000);
INSERT INTO salaries VALUES (2, 120000);
INSERT INTO salaries VALUES (3, 85000);
INSERT INTO salaries VALUES (4, 110000);
INSERT INTO salaries VALUES (5, 70000);
INSERT INTO salaries VALUES (6, 88000);
INSERT INTO salaries VALUES (7, 92000);
INSERT INTO salaries VALUES (8, 65000);
INSERT INTO salaries VALUES (9, 78000);
`
