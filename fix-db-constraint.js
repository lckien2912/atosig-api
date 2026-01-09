require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

async function dropConstraint() {
    try {
        await client.connect();
        console.log('Connected to database:', process.env.DB_DATABASE);

        const query = 'ALTER TABLE "signals" DROP CONSTRAINT IF EXISTS "UQ_462df7d1e8d193eececcb7eaf7f";';
        console.log('Executing:', query);

        await client.query(query);
        console.log('Constraint dropped successfully.');

        // Verify
        const res = await client.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'signals' AND constraint_type = 'UNIQUE';
    `);

        console.log('Remaining UNIQUE constraints on signals table:');
        if (res.rows.length === 0) {
            console.log('None.');
        } else {
            res.rows.forEach(row => console.log(`- ${row.constraint_name}`));
        }

    } catch (err) {
        console.error('Error dropping constraint:', err);
    } finally {
        await client.end();
    }
}

dropConstraint();
