const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'super_secret_admin_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Setup
const db = new sqlite3.Database(':memory:'); // أو استخدام ملف 'database.sqlite'

db.serialize(() => {
    db.run(`CREATE TABLE admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT)`);
    db.run(`CREATE TABLE companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, contact_email TEXT, phone TEXT, address TEXT)`);
    db.run(`CREATE TABLE products (gtin TEXT PRIMARY KEY, name TEXT, description TEXT, price REAL, category TEXT, country_of_origin TEXT DEFAULT 'France', company_id INTEGER, FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL)`);

    // Seed default Admin (Username: admin, Password: admin123password)
    const hash = bcrypt.hashSync('admin123password', 10);
    db.run(`INSERT INTO admins (username, password_hash) VALUES ('admin', '${hash}')`);
    
    // Seed Sample Company & Product
    db.run(`INSERT INTO companies (name, contact_email, phone, address) VALUES ('LVMH France', 'contact@lvmh.fr', '+33123456789', 'Paris, France')`);
    db.run(`INSERT INTO products (gtin, name, description, price, category, country_of_origin, company_id) VALUES ('3012345678901', 'Luxury Perfume', 'Authentic French fragrance', 120.00, 'Cosmetics', 'France', 1)`);
});

// Helper: GTIN Validation (Luhn Check Algorithm)
function isValidGTIN(gtin) {
    if (!/^\d{8}|\d{12}|\d{13}|\d{14}$/.test(gtin)) return false;
    let sum = 0;
    const digits = gtin.split('').map(Number);
    const checkDigit = digits.pop();
    digits.reverse().forEach((digit, idx) => {
        sum += idx % 2 === 0 ? digit * 3 : digit;
    });
    const calculated = (10 - (sum % 10)) % 10;
    return calculated === checkDigit;
}

// Middleware: Verify Admin Access Token
function authenticateAdmin(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access Denied: Admin Auth Required' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid or Expired Token' });
        req.admin = decoded;
        next();
    });
}

// ==========================================
// 1. PUBLIC ROUTES (No Auth Needed)
// ==========================================

// Public Product View
app.get('/api/public/products/:gtin', (req, res) => {
    const { gtin } = req.params;
    const query = `
        SELECT p.gtin, p.name, p.description, p.price, p.category, p.country_of_origin, c.name as company_name 
        FROM products p 
        LEFT JOIN companies c ON p.company_id = c.id 
        WHERE p.gtin = ?
    `;
    db.get(query, [gtin], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Product not found' });
        res.json(row);
    });
});

// Public Bulk GTIN Verification
app.post('/api/public/verify-gtin-bulk', (req, res) => {
    const { gtins } = req.body; // Expecting array of GTIN strings
    if (!Array.isArray(gtins)) return res.status(400).json({ error: 'Invalid GTIN list format' });

    const results = [];
    let processed = 0;

    if (gtins.length === 0) return res.json([]);

    gtins.forEach(gtin => {
        const cleanGTIN = gtin.trim();
        const checksumValid = isValidGTIN(cleanGTIN);

        if (!checksumValid) {
            results.push({ gtin: cleanGTIN, validFormat: false, foundInSystem: false, details: null });
            processed++;
            if (processed === gtins.length) res.json(results);
        } else {
            db.get(`SELECT p.gtin, p.name, p.country_of_origin, c.name as company_name FROM products p LEFT JOIN companies c ON p.company_id = c.id WHERE p.gtin = ?`, [cleanGTIN], (err, row) => {
                results.push({
                    gtin: cleanGTIN,
                    validFormat: true,
                    foundInSystem: !!row,
                    details: row || null
                });
                processed++;
                if (processed === gtins.length) res.json(results);
            });
        }
    });
});

// Admin Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM admins WHERE username = ?`, [username], (err, admin) => {
        if (err || !admin) return res.status(401).json({ error: 'Invalid Credentials' });
        if (!bcrypt.compareSync(password, admin.password_hash)) return res.status(401).json({ error: 'Invalid Credentials' });

        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, username: admin.username });
    });
});

// ==========================================
// 2. PROTECTED ADMIN ROUTES
// ==========================================

// --- PRODUCTS MANAGEMENT ---
app.get('/api/admin/products', authenticateAdmin, (req, res) => {
    db.all(`SELECT p.*, c.name as company_name FROM products p LEFT JOIN companies c ON p.company_id = c.id`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/products', authenticateAdmin, (req, res) => {
    const { gtin, name, description, price, category, country_of_origin, company_id } = req.body;
    
    if (!isValidGTIN(gtin)) {
        return res.status(400).json({ error: 'Invalid GTIN Checksum format' });
    }

    const origin = country_of_origin || 'France';
    const query = `INSERT INTO products (gtin, name, description, price, category, country_of_origin, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [gtin, name, description, price, category, origin, company_id], function(err) {
        if (err) return res.status(400).json({ error: 'Product already exists or database error: ' + err.message });
        res.status(201).json({ message: 'Product created successfully', gtin });
    });
});

app.put('/api/admin/products/:gtin', authenticateAdmin, (req, res) => {
    const { name, description, price, category, country_of_origin, company_id } = req.body;
    const query = `UPDATE products SET name = ?, description = ?, price = ?, category = ?, country_of_origin = ?, company_id = ? WHERE gtin = ?`;
    
    db.run(query, [name, description, price, category, country_of_origin, company_id, req.params.gtin], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Product updated successfully' });
    });
});

app.delete('/api/admin/products/:gtin', authenticateAdmin, (req, res) => {
    db.run(`DELETE FROM products WHERE gtin = ?`, [req.params.gtin], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Product deleted' });
    });
});

// --- COMPANIES MANAGEMENT ---
app.get('/api/admin/companies', authenticateAdmin, (req, res) => {
    db.all(`SELECT * FROM companies`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/companies', authenticateAdmin, (req, res) => {
    const { name, contact_email, phone, address } = req.body;
    db.run(`INSERT INTO companies (name, contact_email, phone, address) VALUES (?, ?, ?, ?)`, [name, contact_email, phone, address], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name });
    });
});

app.put('/api/admin/companies/:id', authenticateAdmin, (req, res) => {
    const { name, contact_email, phone, address } = req.body;
    db.run(`UPDATE companies SET name = ?, contact_email = ?, phone = ?, address = ? WHERE id = ?`, [name, contact_email, phone, address, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Company updated successfully' });
    });
});

app.delete('/api/admin/companies/:id', authenticateAdmin, (req, res) => {
    const companyId = req.params.id;
    // Unlink associated products first or set company_id to NULL
    db.run(`UPDATE products SET company_id = NULL WHERE company_id = ?`, [companyId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`DELETE FROM companies WHERE id = ?`, [companyId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Company removed and product associations unlinked' });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});