const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function check() {
    const client = new Client({
        connectionString: "postgres://postgres:irving@localhost:5433/torresdb"
    });
    await client.connect();

    const res = await client.query("SELECT uuid, folio, pdf_path FROM facturas WHERE folio = 'B-C9C04845'");
    if (res.rows.length === 0) {
        console.log("No invoice found with folio B-C9C04845");
        await client.end();
        return;
    }

    const factura = res.rows[0];
    console.log("DB UUID:", factura.uuid);
    console.log("DB Folio:", factura.folio);
    console.log("DB PDF Path:", JSON.stringify(factura.pdf_path));

    const fileName = path.basename(factura.pdf_path || '');
    console.log("Resolved basename:", fileName);

    const localPath = path.resolve(__dirname, 'pdfs', fileName);
    console.log("Resolved localPath (from script dir):", localPath);
    console.log("Exists in script dir /pdfs/?:", fs.existsSync(localPath));

    const controllerBase = path.resolve(__dirname, 'src/controllers');
    const pseudoLocalPath = path.resolve(controllerBase, '../../pdfs', fileName);
    console.log("Resolved like controller logic:", pseudoLocalPath);
    console.log("Exists like controller logic?:", fs.existsSync(pseudoLocalPath));

    await client.end();
}

check().catch(console.error);
