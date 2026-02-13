const pool = require('../db/index');

// Listar servicios
exports.listarServicios = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM public.servicios WHERE activo = true ORDER BY nombre_servicio ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar servicios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Obtener servicio por ID
exports.obtenerServicio = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM public.servicios WHERE id_servicio = $1',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener servicio:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Crear servicio
exports.crearServicio = async (req, res) => {
    const { nombre_servicio, clave_sat_servicios, precio_unitario, descripcion, clave_unidad, clave_interno } = req.body;
    if (!nombre_servicio || !clave_sat_servicios) {
        return res.status(400).json({ error: 'Nombre y Clave SAT son requeridos' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO public.servicios (nombre_servicio, clave_sat_servicios, precio_unitario, descripcion, clave_unidad, clave_interno)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_servicio`,
            [nombre_servicio, clave_sat_servicios, precio_unitario || 0, descripcion || null, clave_unidad || null, clave_interno || null]
        );
        res.status(201).json({ id_servicio: result.rows[0].id_servicio });
    } catch (error) {
        console.error('Error al crear servicio:', error);
        res.status(500).json({ error: 'Error interno al crear servicio' });
    }
};

// Actualizar servicio
exports.actualizarServicio = async (req, res) => {
    const { id } = req.params;
    const { nombre_servicio, clave_sat_servicios, precio_unitario, descripcion, activo, clave_unidad, clave_interno } = req.body;
    try {
        const result = await pool.query(
            `UPDATE public.servicios 
             SET nombre_servicio = $1, clave_sat_servicios = $2, precio_unitario = $3, descripcion = $4, activo = $5, clave_unidad = $6, clave_interno = $7, updated_at = CURRENT_TIMESTAMP
             WHERE id_servicio = $8`,
            [nombre_servicio, clave_sat_servicios, precio_unitario, descripcion, activo !== undefined ? activo : true, clave_unidad, clave_interno, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }
        res.json({ ok: true });
    } catch (error) {
        console.error('Error al actualizar servicio:', error);
        res.status(500).json({ error: 'Error interno al actualizar servicio' });
    }
};

// Eliminar servicio (soft delete)
exports.eliminarServicio = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE public.servicios SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id_servicio = $1',
            [id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }
        res.json({ ok: true });
    } catch (error) {
        console.error('Error al eliminar servicio:', error);
        res.status(500).json({ error: 'Error interno al eliminar servicio' });
    }
};
