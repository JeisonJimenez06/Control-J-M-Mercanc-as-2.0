const TOKEN = "patZLW6DeVrBvuzm1.d6ebc2f78383cf0452f18d573f94817afa7bc3696d8d69394a894d576c3d6efd";
const BASE = "appdV7iObspvoiWpq";
const TABLA = "DB_MercanciaJM";

// VARIABLE GLOBAL PARA GUARDAR DATOS TEMPORALMENTE
let datosParaPDF = null;

function validarAcceso() {
    if(document.getElementById('passInput').value === "admin123") {
        document.getElementById('loginContainer').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        document.getElementById('mainFooter').classList.remove('hidden');
        cargar();
    } else {
        alert("Contraseña incorrecta");
    }
}

function calcResta() {
    const p = parseFloat(document.getElementById('pre').value) || 0;
    const a = parseFloat(document.getElementById('abo').value) || 0;
    document.getElementById('valRes').value = "$" + (p - a).toLocaleString('es-CO');
}

async function cargar() {
    try {
        const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLA}?sort%5B0%5D%5Bfield%5D=Cliente&sort%5B0%5D%5Bdirection%5D=asc`, { 
            headers: { Authorization: `Bearer ${TOKEN}` } 
        });
        const data = await res.json();
        window.datosCompletos = data.records;
        
        const tbody = document.getElementById('lista');
        tbody.innerHTML = "";
        
        let totalCobrar = 0;
        let totalAbonos = 0;
        let contadorRegistros = data.records.length;

        data.records.forEach(r => {
            const f = r.fields;
            const precio = f.Precio || 0;
            const abono = f.Abono || 0;
            const saldo = precio - abono;
            
            totalCobrar += saldo;
            totalAbonos += abono;

            const tr = document.createElement('tr');
            tr.className = saldo <= 0 ? "pago-ok" : "pago-deuda";
            tr.innerHTML = `
                <td class="text-start"><strong>${f.Cliente}</strong></td>
                <td>${f.Producto}</td>
                <td>$${abono.toLocaleString('es-CO')}</td>
                <td class="fw-bold">$${saldo.toLocaleString('es-CO')}</td>
                <td>
                    <div class="btn-group">
                        <button onclick='enviarWhatsApp(${JSON.stringify(r)})' class="btn btn-success btn-sm"><i class="bi bi-whatsapp"></i></button>
                        <button onclick='imprimirFacturaNativa(${JSON.stringify(r.fields)})' class="btn btn-info btn-sm text-white"><i class="bi bi-printer"></i></button>
                        <button onclick='editar(${JSON.stringify(r)})' class="btn btn-warning btn-sm mx-1"><i class="bi bi-pencil"></i></button>
                        <button onclick='borrar("${r.id}")' class="btn btn-danger btn-sm"><i class="bi bi-trash"></i></button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });

        document.getElementById('statCobrar').innerText = "$" + totalCobrar.toLocaleString('es-CO');
        document.getElementById('statAbonos').innerText = "$" + totalAbonos.toLocaleString('es-CO');
        document.getElementById('statRegistros').innerText = contadorRegistros;

    } catch(e) { console.error(e); }
}

// --- FUNCIONES PARA VISTA PREVIA Y DESCARGA ---

function imprimirFacturaNativa(f) {
    datosParaPDF = f; // Guardamos los datos en la variable global
    const saldo = (f.Precio || 0) - (f.Abono || 0);
    const fecha = new Date().toLocaleDateString();
    
    const disenoTicket = `
        <div id="ticket-final" style="width: 300px; padding: 20px; font-family: monospace; color: black; background: white; border: 1px solid #eee;">
            <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
                <h2 style="margin:0; font-size: 18px;">J&M MERCANCÍA</h2>
                <p style="margin:5px 0; font-size: 11px;">Comprobante de Pago</p>
            </div>
            <div style="font-size: 12px; line-height: 1.5;">
                <p style="margin: 2px 0;"><strong>FECHA:</strong> ${fecha}</p>
                <p style="margin: 2px 0;"><strong>CLIENTE:</strong> ${f.Cliente}</p>
                <p style="margin: 2px 0;"><strong>PRODUCTO:</strong> ${f.Producto}</p>
            </div>
            <div style="margin-top: 10px; border-top: 1px dashed black; padding-top: 10px; text-align: right;">
                <p style="margin: 2px 0;">TOTAL: $${(f.Precio || 0).toLocaleString('es-CO')}</p>
                <p style="margin: 2px 0;">ABONO: $${(f.Abono || 0).toLocaleString('es-CO')}</p>
                <p style="font-size: 16px; font-weight: bold; margin: 5px 0;">SALDO: $${saldo.toLocaleString('es-CO')}</p>
            </div>
            <p style="text-align:center; font-size:10px; margin-top:15px; border-top: 1px solid #eee; padding-top:5px;">¡Gracias por su compra!</p>
        </div>
    `;

    document.getElementById('contenedorPreview').innerHTML = disenoTicket;
    document.getElementById('modalFactura').classList.remove('hidden');

    document.getElementById('btnConfirmarDescarga').onclick = function() {
        procesarDescargaPDF(f.Cliente);
    };
}

async function procesarDescargaPDF(nombreCliente) {
    const elemento = document.getElementById('ticket-final');
    const opciones = {
        margin: 0.2,
        filename: `Factura_${nombreCliente}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
        // 1. Descarga el PDF
        await html2pdf().set(opciones).from(elemento).save();
        
        // 2. Prepara y envía WhatsApp si existen los datos
        if (datosParaPDF) {
            const f = datosParaPDF;
            const saldo = (f.Precio || 0) - (f.Abono || 0);
            const msj = `Hola *${f.Cliente}*, J&M Mercancía le adjunta su factura de *${f.Producto}*. Su saldo actual es: *$${saldo.toLocaleString('es-CO')}*.`;
            
            const telLimpiado = (f.Telefono || '').replace(/\D/g,'');
            if(telLimpiado) {
                window.open(`https://wa.me/57${telLimpiado}?text=${encodeURIComponent(msj)}`, '_blank');
            }
        }

        cerrarPreview(); 
    } catch (error) {
        console.error("Error al procesar:", error);
        alert("Error al generar factura.");
    }
}

function cerrarPreview() {
    document.getElementById('modalFactura').classList.add('hidden');
    datosParaPDF = null;
}

// --- FUNCIONES DE FORMULARIO Y TABLA ---

document.getElementById('formM').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const campos = {
        "Cliente": document.getElementById('cli').value,
        "Telefono": document.getElementById('tel').value,
        "Direccion": document.getElementById('dir').value,
        "Producto": document.getElementById('pro').value,
        "Precio": parseFloat(document.getElementById('pre').value),
        "Abono": parseFloat(document.getElementById('abo').value),
        "MetodoPago": document.getElementById('metodo').value
    };
    await fetch(id ? `https://api.airtable.com/v0/${BASE}/${TABLA}/${id}` : `https://api.airtable.com/v0/${BASE}/${TABLA}`, {
        method: id ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: campos })
    });
    
    if (!id) imprimirFacturaNativa(campos);
    resetForm(); cargar();
});

function enviarWhatsApp(r) {
    const f = r.fields;
    const saldo = (f.Precio || 0) - (f.Abono || 0);
    const msj = `Hola *${f.Cliente}*, J&M Mercancía le informa su saldo de *${f.Producto}*: *$${saldo.toLocaleString('es-CO')}*.`;
    window.open(`https://wa.me/57${(f.Telefono || '').replace(/\D/g,'')}?text=${encodeURIComponent(msj)}`, '_blank');
}

function descargarReporte() {
    if (!window.datosCompletos) return;
    let csv = "\ufeffCliente;Telefono;Producto;Precio;Abono;Saldo\n";
    window.datosCompletos.forEach(r => {
        const f = r.fields;
        csv += `"${f.Cliente}";"${f.Telefono || ''}";"${f.Producto}";"${f.Precio}";"${f.Abono}";"${f.Precio-f.Abono}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Reporte_JM.csv`; a.click();
}

function editar(r) {
    const f = r.fields;
    document.getElementById('editId').value = r.id;
    document.getElementById('cli').value = f.Cliente;
    document.getElementById('tel').value = f.Telefono || "";
    document.getElementById('dir').value = f.Direccion || "";
    document.getElementById('pro').value = f.Producto;
    document.getElementById('pre').value = f.Precio;
    document.getElementById('abo').value = f.Abono;
    document.getElementById('metodo').value = f.MetodoPago || "Efectivo";
    calcResta();
    document.getElementById('btnG').innerText = "Actualizar";
    document.getElementById('btnCan').classList.remove('d-none');
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function resetForm() {
    document.getElementById('formM').reset();
    document.getElementById('editId').value = "";
    document.getElementById('btnG').innerText = "Guardar Datos";
    document.getElementById('btnCan').classList.add('d-none');
    calcResta();
}

async function borrar(id) { 
    if(confirm("¿Eliminar?")) { 
        await fetch(`https://api.airtable.com/v0/${BASE}/${TABLA}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } }); 
        cargar(); 
    } 
}

function filtrar() {
    const val = document.getElementById('searchInput').value.toUpperCase();
    document.querySelectorAll('#lista tr').forEach(tr => tr.style.display = tr.innerText.toUpperCase().includes(val) ? "" : "none");
}