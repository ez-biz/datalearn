import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { ECOMMERCE_SCHEMA } from '../lib/seed-data'
import { HR_SCHEMA } from '../lib/seed-data-hr'

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const USERS_SCHEMA = [
    "CREATE TABLE users (id INTEGER, name VARCHAR, role VARCHAR)",
    "INSERT INTO users VALUES (1, 'Alice', 'Engineer')",
    "INSERT INTO users VALUES (2, 'Bob', 'Sales')"
].join(';\n') + ';'

async function main() {
    const adminEmail = 'anchitgupt2012@gmail.com'
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: { role: 'ADMIN' },
        create: {
            email: adminEmail,
            name: 'Anchit Gupta',
            role: 'ADMIN',
        },
    })

    const topic = await prisma.topic.upsert({
        where: { slug: 'data-engineering-101' },
        update: {},
        create: {
            name: 'Data Engineering 101',
            slug: 'data-engineering-101',
            description: 'Introduction to Data Engineering concepts.',
        },
    })

    await prisma.article.upsert({
        where: { slug: 'what-is-etl' },
        update: {},
        create: {
            title: 'What is ETL?',
            slug: 'what-is-etl',
            content: `
# What is ETL ?

** ETL ** stands for Extract, Transform, Load.

## Process
1. ** Extract **: Get data from source.
2. ** Transform **: Clean and format data.
3. ** Load **: Save to data warehouse.

\`\`\`python
def etl_process():
    data = extract()
    clean_data = transform(data)
    load(clean_data)
\`\`\`
      `,
            published: true,
            topicId: topic.id,
            authorId: 'system',
        },
    })

    await prisma.article.upsert({
        where: { slug: 'batch-vs-stream-processing' },
        update: {},
        create: {
            title: 'Batch vs Stream Processing',
            slug: 'batch-vs-stream-processing',
            content: `
# Batch vs Stream Processing

Data engineering pipelines generally fall into two camps: **batch** and **stream**.

## Batch processing

Batch jobs run on a schedule (hourly, daily, weekly). They read a bounded slice of data, transform it, and write the result somewhere. Think: the nightly ETL that rebuilds yesterday's sales dashboard.

- **Latency**: minutes to hours
- **Volume per job**: large (GB to TB)
- **Failure handling**: re-run the batch
- **Typical tools**: Airflow, dbt, Spark, Snowflake tasks

## Stream processing

Stream jobs run continuously. They process each record (or small windows of records) as it arrives.

- **Latency**: milliseconds to seconds
- **Volume per event**: tiny, but the stream is unbounded
- **Failure handling**: checkpointing, replay from an offset
- **Typical tools**: Kafka + Flink, Kinesis + Lambda, Pulsar, Materialize

## Which do you pick?

Start with batch. It is cheaper, simpler to reason about, and easier to test. Move to streaming only when the business genuinely cannot tolerate batch latency — fraud detection, live pricing, real-time personalization.

A common pitfall is building a streaming pipeline because it sounds modern, then paying the operational tax for a use case that would have been happy with hourly batches.

## The middle ground

**Micro-batching** (Spark Structured Streaming, hourly dbt) splits the difference: small batches, near-real-time feel, batch simplicity. Most "real-time" dashboards are actually micro-batched on a short cadence.
            `,
            published: true,
            topicId: topic.id,
            authorId: 'system',
        },
    })

    await prisma.article.upsert({
        where: { slug: 'oltp-vs-olap' },
        update: {},
        create: {
            title: 'OLTP vs OLAP',
            slug: 'oltp-vs-olap',
            content: `
# OLTP vs OLAP

Two database worlds, two different jobs.

## OLTP — Online Transaction Processing

OLTP databases run the app. Every user action — checkout, like, signup — is a tiny transaction that reads or writes a handful of rows.

- **Workload**: many small, fast queries per second
- **Access pattern**: row-oriented — fetch or update a specific record
- **Schema**: highly normalized (3NF)
- **Indexes**: B-tree on primary keys, foreign keys, frequently-filtered columns
- **Examples**: PostgreSQL, MySQL, SQL Server

## OLAP — Online Analytical Processing

OLAP databases answer questions. They are read-heavy, scan huge ranges of rows, and aggregate.

- **Workload**: few large queries, lots of rows scanned per query
- **Access pattern**: column-oriented — read only the columns you aggregate
- **Schema**: denormalized (star schemas, fact + dimension tables)
- **Indexes**: compressed columnar storage, zone maps, bloom filters
- **Examples**: Snowflake, BigQuery, Redshift, ClickHouse, DuckDB

## Why the split?

An OLTP row-store is bad at scanning 100M rows to answer "total revenue by country last quarter" — it reads whole rows just to pull two columns. An OLAP column-store is bad at "update user 42's email" — it has to rewrite an entire column segment.

Most data architectures keep both. App writes go to OLTP (Postgres). A pipeline ships those writes into OLAP (Snowflake / BigQuery) where analysts and dashboards live.

## The modern twist

Postgres with extensions (Citus, TimescaleDB) and DuckDB embedded in apps blur the line for smaller workloads. At TB+ scale the split still matters.
            `,
            published: true,
            topicId: topic.id,
            authorId: 'system',
        },
    })

    const usersSchema = await prisma.sqlSchema.upsert({
        where: { name: 'users' },
        update: { sql: USERS_SCHEMA },
        create: { name: 'users', sql: USERS_SCHEMA },
    })

    const ecommerceSchema = await prisma.sqlSchema.upsert({
        where: { name: 'ecommerce' },
        update: { sql: ECOMMERCE_SCHEMA },
        create: { name: 'ecommerce', sql: ECOMMERCE_SCHEMA },
    })

    const hrSchema = await prisma.sqlSchema.upsert({
        where: { name: 'hr' },
        update: { sql: HR_SCHEMA },
        create: { name: 'hr', sql: HR_SCHEMA },
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'simple-select' },
        update: {
            schemaId: usersSchema.id,
        },
        create: {
            title: 'Simple Select',
            slug: 'simple-select',
            difficulty: 'EASY',
            description: 'Select all columns from the users table.',
            schemaDescription: 'Table `users` with columns: id, name, role',
            schemaId: usersSchema.id,
            expectedOutput: '[{"id":1,"name":"Alice","role":"Engineer"},{"id":2,"name":"Bob","role":"Sales"}]'
        }
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'total-revenue-per-customer' },
        update: {
            schemaId: ecommerceSchema.id,
            ordered: true,
        },
        create: {
            title: 'Total Revenue Per Customer',
            slug: 'total-revenue-per-customer',
            difficulty: 'MEDIUM',
            description: 'Calculate the total revenue generated by each customer who has placed at least one order. Return columns `name` and `total_revenue`. Order by `total_revenue` descending.',
            schemaId: ecommerceSchema.id,
            schemaDescription: 'Tables: customers, orders, order_items, products',
            ordered: true,
            expectedOutput: '[{"name":"John Doe","total_revenue":1450},{"name":"Alice Johnson","total_revenue":1350},{"name":"Jane Smith","total_revenue":800}]'
        }
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'top-selling-products' },
        update: {
            schemaId: ecommerceSchema.id,
            ordered: true,
        },
        create: {
            title: 'Top Selling Products',
            slug: 'top-selling-products',
            difficulty: 'HARD',
            description: 'Find the top 3 products by total quantity sold. Return columns `name` and `total_sold`. Order by `total_sold` descending, then `name` ascending.',
            schemaId: ecommerceSchema.id,
            schemaDescription: 'Tables: products, order_items',
            ordered: true,
            expectedOutput: '[{"name":"Desk Chair","total_sold":2},{"name":"Laptop","total_sold":2},{"name":"Headphones","total_sold":1}]'
        }
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'customers-by-country' },
        update: {
            schemaId: ecommerceSchema.id,
            ordered: false,
            description: 'Return every customer whose `country` is `USA`. Return columns `customer_id`, `name`, `email`, `country`.',
            schemaDescription: 'Table `customers` with columns: customer_id, name, email, country',
            expectedOutput: '[{"customer_id":1,"name":"John Doe","email":"john@example.com","country":"USA"},{"customer_id":4,"name":"Bob Brown","email":"bob@example.com","country":"USA"}]'
        },
        create: {
            title: 'Customers by Country',
            slug: 'customers-by-country',
            difficulty: 'EASY',
            description: 'Return every customer whose `country` is `USA`. Return columns `customer_id`, `name`, `email`, `country`.',
            schemaDescription: 'Table `customers` with columns: customer_id, name, email, country',
            schemaId: ecommerceSchema.id,
            ordered: false,
            expectedOutput: '[{"customer_id":1,"name":"John Doe","email":"john@example.com","country":"USA"},{"customer_id":4,"name":"Bob Brown","email":"bob@example.com","country":"USA"}]'
        }
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'orders-in-january-2023' },
        update: {
            schemaId: ecommerceSchema.id,
            ordered: false,
        },
        create: {
            title: 'Orders in January 2023',
            slug: 'orders-in-january-2023',
            difficulty: 'EASY',
            description: 'Count the number of orders placed between 2023-01-01 and 2023-01-31 (inclusive). Return a single column `order_count`.',
            schemaDescription: 'Table `orders` with columns: order_id, customer_id, order_date, total_amount',
            schemaId: ecommerceSchema.id,
            ordered: false,
            expectedOutput: '[{"order_count":2}]'
        }
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'average-order-value' },
        update: {
            schemaId: ecommerceSchema.id,
            ordered: false,
        },
        create: {
            title: 'Average Order Value',
            slug: 'average-order-value',
            difficulty: 'EASY',
            description: 'Compute the average of `total_amount` across all orders. Return a single column `avg_amount`.',
            schemaDescription: 'Table `orders` with columns: order_id, customer_id, order_date, total_amount',
            schemaId: ecommerceSchema.id,
            ordered: false,
            expectedOutput: '[{"avg_amount":900}]'
        }
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'customers-with-multiple-orders' },
        update: {
            schemaId: ecommerceSchema.id,
            ordered: false,
        },
        create: {
            title: 'Customers with Multiple Orders',
            slug: 'customers-with-multiple-orders',
            difficulty: 'MEDIUM',
            description: 'Find each customer who has placed more than one order. Return `customer_id` and `order_count`.',
            schemaDescription: 'Tables: customers, orders',
            schemaId: ecommerceSchema.id,
            ordered: false,
            expectedOutput: '[{"customer_id":1,"order_count":2}]'
        }
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'products-never-ordered' },
        update: {
            schemaId: ecommerceSchema.id,
            ordered: false,
        },
        create: {
            title: 'Products Never Ordered',
            slug: 'products-never-ordered',
            difficulty: 'MEDIUM',
            description: 'Find products that have never appeared in any order. Return `product_id` and `name`.',
            schemaDescription: 'Tables: products, order_items',
            schemaId: ecommerceSchema.id,
            ordered: false,
            expectedOutput: '[{"product_id":104,"name":"Coffee Table"}]'
        }
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'employees-hired-in-2025' },
        update: {
            schemaId: hrSchema.id,
            ordered: false,
        },
        create: {
            title: 'Employees Hired in 2025',
            slug: 'employees-hired-in-2025',
            difficulty: 'EASY',
            description: 'Find employees whose `hire_date` falls in the 2025 calendar year. Return `id` and `name`.',
            schemaDescription: 'Table `employees` with columns: id, name, department_id, hire_date',
            schemaId: hrSchema.id,
            ordered: false,
            expectedOutput: '[{"id":1,"name":"Alice"},{"id":3,"name":"Charlie"},{"id":5,"name":"Eve"}]'
        }
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'highest-paid-per-department' },
        update: {
            schemaId: hrSchema.id,
            ordered: false,
        },
        create: {
            title: 'Highest-Paid Employee per Department',
            slug: 'highest-paid-per-department',
            difficulty: 'MEDIUM',
            description: 'For each department, find the employee with the highest salary. Return `department_name`, `employee_name`, and `salary`.',
            schemaDescription: 'Tables: departments, employees, salaries',
            schemaId: hrSchema.id,
            ordered: false,
            expectedOutput: '[{"department_name":"Engineering","employee_name":"Bob","salary":120000},{"department_name":"Sales","employee_name":"Diana","salary":110000},{"department_name":"Marketing","employee_name":"Eve","salary":70000}]'
        }
    })

    await prisma.sQLProblem.upsert({
        where: { slug: 'largest-department' },
        update: {
            schemaId: hrSchema.id,
            ordered: true,
        },
        create: {
            title: 'Largest Department by Headcount',
            slug: 'largest-department',
            difficulty: 'MEDIUM',
            description: 'Find the single department with the most employees. Return `department_name` and `employee_count`. Use `LIMIT 1` after ordering by headcount descending.',
            schemaDescription: 'Tables: departments, employees',
            schemaId: hrSchema.id,
            ordered: true,
            expectedOutput: '[{"department_name":"Engineering","employee_count":4}]'
        }
    })

    // ----------------------------------------------------------------
    // New problem drafts (PR #8). Each ships with solution SQL but no
    // expectedOutput — author opens each in the admin UI, hits
    // "Run & capture" to populate expectedOutput from the solution,
    // then flips status to PUBLISHED. The publish transition snapshots
    // a ProblemVersion automatically.
    // ----------------------------------------------------------------
    type Draft = {
        slug: string
        title: string
        difficulty: 'EASY' | 'MEDIUM' | 'HARD'
        ordered: boolean
        description: string
        schemaDescription: string
        schemaId: string
        solutionSql: string
        tagSlugs: string[]
    }

    const drafts: Draft[] = [
        // Joins
        {
            slug: 'customers-with-orders',
            title: 'Customers Who Have Ordered',
            difficulty: 'EASY',
            ordered: true,
            description:
                'Return customers who have placed at least one order. Return columns customer_id, name, ordered ascending by customer_id.',
            schemaDescription: '',
            schemaId: ecommerceSchema.id,
            solutionSql:
                'SELECT DISTINCT c.customer_id, c.name FROM customers c JOIN orders o ON o.customer_id = c.customer_id ORDER BY c.customer_id',
            tagSlugs: ['joins'],
        },
        {
            slug: 'customers-with-no-orders',
            title: 'Customers Who Have Never Ordered',
            difficulty: 'MEDIUM',
            ordered: true,
            description:
                'Return customers who have not placed any order. Return columns customer_id, name, country, ordered by customer_id ascending.',
            schemaDescription: '',
            schemaId: ecommerceSchema.id,
            solutionSql:
                'SELECT customer_id, name, country FROM customers WHERE customer_id NOT IN (SELECT DISTINCT customer_id FROM orders) ORDER BY customer_id',
            tagSlugs: ['joins', 'anti-join'],
        },
        {
            slug: 'employees-with-department',
            title: 'Employees and Their Departments',
            difficulty: 'EASY',
            ordered: true,
            description:
                'Return every employee with their department name. Return columns name, department, ordered alphabetically by name.',
            schemaDescription: '',
            schemaId: hrSchema.id,
            solutionSql:
                'SELECT e.name, d.name AS department FROM employees e JOIN departments d ON d.id = e.department_id ORDER BY e.name',
            tagSlugs: ['joins', 'hr'],
        },

        // Aggregates
        {
            slug: 'orders-per-country',
            title: 'Orders per Country',
            difficulty: 'EASY',
            ordered: true,
            description:
                'Count orders by the customer country. Return columns country, order_count. Order by order_count desc, then country asc.',
            schemaDescription: '',
            schemaId: ecommerceSchema.id,
            solutionSql:
                'SELECT c.country, COUNT(*) AS order_count FROM orders o JOIN customers c ON c.customer_id = o.customer_id GROUP BY c.country ORDER BY order_count DESC, c.country ASC',
            tagSlugs: ['aggregation', 'group-by'],
        },
        {
            slug: 'avg-salary-per-department',
            title: 'Average Salary per Department',
            difficulty: 'MEDIUM',
            ordered: true,
            description:
                'Compute the average salary for each department. Return columns department, avg_salary, ordered by avg_salary descending.',
            schemaDescription: '',
            schemaId: hrSchema.id,
            solutionSql:
                'SELECT d.name AS department, AVG(s.amount) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id JOIN salaries s ON s.employee_id = e.id GROUP BY d.name ORDER BY avg_salary DESC',
            tagSlugs: ['aggregation', 'hr'],
        },
        {
            slug: 'highest-spending-customer',
            title: 'Highest-Spending Customer',
            difficulty: 'MEDIUM',
            ordered: false,
            description:
                'Return the single customer who has spent the most across all orders. Return columns name, total_spent.',
            schemaDescription: '',
            schemaId: ecommerceSchema.id,
            solutionSql:
                'SELECT c.name, SUM(o.total_amount) AS total_spent FROM customers c JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.name ORDER BY total_spent DESC LIMIT 1',
            tagSlugs: ['aggregation'],
        },

        // Window functions
        {
            slug: 'employee-salary-rank',
            title: 'Employee Salary Rank by Department',
            difficulty: 'MEDIUM',
            ordered: true,
            description:
                'Rank each employee by salary within their department, highest first. Return columns name, department, salary, rank. Order by department asc, then rank asc.',
            schemaDescription: '',
            schemaId: hrSchema.id,
            solutionSql:
                'SELECT e.name, d.name AS department, s.amount AS salary, RANK() OVER (PARTITION BY d.id ORDER BY s.amount DESC) AS rank FROM employees e JOIN departments d ON d.id = e.department_id JOIN salaries s ON s.employee_id = e.id ORDER BY department ASC, rank ASC',
            tagSlugs: ['window-functions', 'hr'],
        },
        {
            slug: 'running-revenue',
            title: 'Running Revenue by Order Date',
            difficulty: 'MEDIUM',
            ordered: true,
            description:
                'Show each order with a running total of total_amount across orders, ordered by order_date. Return columns order_id, order_date, total_amount, running_total.',
            schemaDescription: '',
            schemaId: ecommerceSchema.id,
            solutionSql:
                'SELECT order_id, order_date, total_amount, SUM(total_amount) OVER (ORDER BY order_date, order_id) AS running_total FROM orders ORDER BY order_date, order_id',
            tagSlugs: ['window-functions'],
        },
        {
            slug: 'salary-vs-department-avg',
            title: 'Salary vs Department Average',
            difficulty: 'HARD',
            ordered: true,
            description:
                'For each employee, return their salary and the difference vs their department average. Return columns name, department, salary, dept_avg, diff. Order by department, then diff descending.',
            schemaDescription: '',
            schemaId: hrSchema.id,
            solutionSql:
                'SELECT e.name, d.name AS department, s.amount AS salary, AVG(s.amount) OVER (PARTITION BY d.id) AS dept_avg, s.amount - AVG(s.amount) OVER (PARTITION BY d.id) AS diff FROM employees e JOIN departments d ON d.id = e.department_id JOIN salaries s ON s.employee_id = e.id ORDER BY department ASC, diff DESC',
            tagSlugs: ['window-functions', 'hr'],
        },

        // CTEs
        {
            slug: 'top-2-products-per-category',
            title: 'Top 2 Priced Products per Category',
            difficulty: 'MEDIUM',
            ordered: true,
            description:
                'Return the two highest-priced products in each category. Return columns category, name, price. Order by category asc, then price desc.',
            schemaDescription: '',
            schemaId: ecommerceSchema.id,
            solutionSql:
                'WITH ranked AS (SELECT category, name, price, ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn FROM products) SELECT category, name, price FROM ranked WHERE rn <= 2 ORDER BY category, price DESC',
            tagSlugs: ['cte', 'window-functions'],
        },
        {
            slug: 'employees-above-dept-avg',
            title: 'Employees Earning Above Department Average',
            difficulty: 'MEDIUM',
            ordered: true,
            description:
                'Return employees whose salary is strictly greater than their department average. Return columns name, department, salary. Order alphabetically by name.',
            schemaDescription: '',
            schemaId: hrSchema.id,
            solutionSql:
                'WITH dept_avg AS (SELECT e.department_id, AVG(s.amount) AS avg_amount FROM employees e JOIN salaries s ON s.employee_id = e.id GROUP BY e.department_id) SELECT e.name, d.name AS department, s.amount AS salary FROM employees e JOIN departments d ON d.id = e.department_id JOIN salaries s ON s.employee_id = e.id JOIN dept_avg da ON da.department_id = e.department_id WHERE s.amount > da.avg_amount ORDER BY e.name',
            tagSlugs: ['cte', 'hr'],
        },

        // Subqueries
        {
            slug: 'most-recent-hire-per-dept',
            title: 'Most Recent Hire per Department',
            difficulty: 'HARD',
            ordered: true,
            description:
                'Return the most recently hired employee in each department. Return columns department, name, hire_date. Order alphabetically by department.',
            schemaDescription: '',
            schemaId: hrSchema.id,
            solutionSql:
                'SELECT d.name AS department, e.name, e.hire_date FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.hire_date = (SELECT MAX(e2.hire_date) FROM employees e2 WHERE e2.department_id = e.department_id) ORDER BY department',
            tagSlugs: ['subqueries', 'hr'],
        },
    ]

    for (const d of drafts) {
        // Upsert tags first
        const tagConnects = []
        for (const slug of d.tagSlugs) {
            const tag = await prisma.tag.upsert({
                where: { slug },
                update: {},
                create: { slug, name: slug.replace(/-/g, ' ') },
            })
            tagConnects.push({ id: tag.id })
        }

        await prisma.sQLProblem.upsert({
            where: { slug: d.slug },
            update: {},
            create: {
                title: d.title,
                slug: d.slug,
                difficulty: d.difficulty,
                status: 'DRAFT',
                description: d.description,
                schemaDescription: d.schemaDescription,
                schemaId: d.schemaId,
                expectedOutput: '[]',
                solutionSql: d.solutionSql,
                ordered: d.ordered,
                tags: { connect: tagConnects },
            },
        })
    }

    console.log(`Seed data created. (${drafts.length} new drafts pending capture.)`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        if (e.code === 'P2002') return
        console.error(e)
        process.exit(1)
    })
