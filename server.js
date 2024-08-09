const express = require('express');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 5000;

mongoose.set('strictQuery', true);

mongoose.connect('mongodb://mongo:27017/admin', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('MongoDB connection successful');
})
.catch((err) => {
    console.error('MongoDB connection error:', err);
});

app.use(express.json());

const customerSchema = new mongoose.Schema({
    username: String,
    membershipType: String,
    tierType: String,
    tier_and_details: Object
}, { strict: false });

const transactionSchema = new mongoose.Schema({
    transaction_code: String,
    amount: Number
}, { strict: false });

const Customer = mongoose.model('Customer', customerSchema, 'customers');
const Transaction = mongoose.model('Transaction', transactionSchema, 'transactions');

app.get('/api/data', async (req, res) => {
    try {
        const data = await Customer.find({});
        res.json(data);
    } catch (err) {
        res.status(500).send(err);
    }
});


app.get('/api/customers/silver', async (req, res) => {
    try {
        const customers = await Customer.find({}).exec();

        const silverCustomers = customers.map(customer => {
            const customerObj = customer.toObject();
            const silverDetails = Object.entries(customerObj.tier_and_details || {}).filter(([key, value]) => value.tier === 'Silver');

            if (silverDetails.length > 0) {
                return {
                    _id: customerObj._id,
                    username: customerObj.username,
                    name: customerObj.name,
                    address: customerObj.address,
                    birthdate: customerObj.birthdate,
                    email: customerObj.email,
                    accounts: customerObj.accounts,
                    tier_and_details: Object.fromEntries(silverDetails)
                };
            }
            return null;
        }).filter(customer => customer !== null);

        res.json(silverCustomers);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'An error occurred', details: err.message });
    }
});

app.get('/api/transactions/buy', async (req, res) => {
    try {
        const transactions = await Transaction.aggregate([
            { $unwind: "$transactions" },
            { $match: { "transactions.transaction_code": "buy" } },
            { $project: { _id: 0, transaction_code: "$transactions.transaction_code", amount: "$transactions.amount" } }
        ]);

        res.json(transactions);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/api/customers/username/j', async (req, res) => {
    try {
        const customers = await Customer.find({ username: /^j/i });
        res.json(customers);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.delete('/api/customers/delete-james', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const regex = /james/i;
        let totalDeleted = 0;

        for (let collection of collections) {
            const collectionName = collection.name;
            const result = await db.collection(collectionName).deleteMany({ name: { $regex: regex } });
            console.log(`Deleted ${result.deletedCount} from ${collectionName}`);
            totalDeleted += result.deletedCount;
        }

        if (totalDeleted > 0) {
            res.json({ message: `${totalDeleted} customers deleted.` });
        } else {
            res.json({ message: "No customers found with the name containing 'james'." });
        }
    } catch (err) {
        console.error('Error deleting customers:', err);
        res.status(500).json({ error: 'An error occurred', details: err.message });
    }
});

app.post('/api/customers/update-tier', async (req, res) => {
    try {
        const customers = await Customer.find({});
        console.log('Initial Customers:', customers);
        await Promise.all(customers.map(async (customer) => {
            let updated = false;
            Object.keys(customer.tier_and_details).forEach((key) => {
                if (customer.tier_and_details[key].tier === 'Gold') {
                    customer.tier_and_details[key].tier = 'PLATINUM';
                    updated = true;
                }
            });
            if (updated) {
                await customer.save();
                console.log('Updated Customer:', customer);
            }
        }));
        res.json({ message: "Tiers updated successfully." });
    } catch (err) {
        console.error('Error updating tiers:', err);
        res.status(500).send(err);
    }
});

app.delete('/api/customers/delete-platinum', async (req, res) => {
    try {
        const customers = await Customer.find({}).exec();

        const platinumCustomers = customers.filter(customer => {
            const customerObj = customer.toObject();
            const platinumDetails = Object.entries(customerObj.tier_and_details || {}).filter(([key, value]) => value.tier === 'Platinum');
            return platinumDetails.length > 0;
        });

        const deletePromises = platinumCustomers.map(customer => Customer.deleteOne({ _id: customer._id }));
        const deleteResults = await Promise.all(deletePromises);

        const deletedCount = deleteResults.reduce((count, result) => count + (result.deletedCount || 0), 0);
        
        if (deletedCount > 0) {
            res.json({ message: `${deletedCount} customers with Platinum tier deleted.` });
        } else {
            res.json({ message: "No customers with Platinum tier found." });
        }
    } catch (err) {
        console.error('Error deleting Platinum tier customers:', err);
        res.status(500).json({ error: 'An error occurred', details: err.message });
    }
});




app.get('/api/customers/all', async (req, res) => {
    try {
        const customers = await Customer.find({});
        res.json(customers);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.post('/api/customers', async (req, res) => {
    try {
        const { username, name, address, birthdate, email, accounts, tier_and_details } = req.body;

        const newCustomer = new Customer({
            username,
            name,
            address,
            birthdate,
            email,
            accounts,
            tier_and_details
        });

        await newCustomer.save();
        res.status(201).json(newCustomer);
    } catch (err) {
        res.status(500).json({ error: 'An error occurred', details: err.message });
    }
});

app.post('/api/transactions', async (req, res) => {
    try {
        const { transaction_code, amount } = req.body;

        const newTransaction = new Transaction({
            transaction_code,
            amount
        });

        await newTransaction.save();
        res.status(201).json(newTransaction);
    } catch (err) {
        res.status(500).json({ error: 'An error occurred', details: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
