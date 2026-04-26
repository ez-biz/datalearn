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
    // SECURITY: do not seed the admin row at role=ADMIN.
    //
    // The auth-time signIn callback refuses to auto-link OAuth identities
    // onto pre-seeded elevated-role users (Google account-takeover guard).
    // To keep the seed idempotent and the operator workflow safe:
    //   1. Seed the row at role=USER if it doesn't exist.
    //   2. Don't touch role on subsequent runs (`update: {}`) — operator
    //      promotes via psql or /admin/contributors after first sign-in.
    //   3. The admin row only acts as the legal `authorId` FK for seeded
    //      articles; it doesn't need ADMIN rights to satisfy the FK.
    const adminEmail = 'anchitgupt2012@gmail.com'
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            name: 'Anchit Gupta',
            role: 'USER',
        },
    })
    const adminId = admin.id

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
            status: 'PUBLISHED',
            topicId: topic.id,
            authorId: adminId,
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
            status: 'PUBLISHED',
            topicId: topic.id,
            authorId: adminId,
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
            status: 'PUBLISHED',
            topicId: topic.id,
            authorId: adminId,
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

    console.log('Seed data created.')
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
