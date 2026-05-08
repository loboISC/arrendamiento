-- Seed idempotente de choferes para produccion.
-- Se puede ejecutar varias veces sin duplicar empleados.

BEGIN;

INSERT INTO rh_departamentos (nombre)
VALUES ('OPERACIONES')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO rh_puestos (nombre, departamento_id)
SELECT 'CHOFER', d.id
FROM rh_departamentos d
WHERE d.nombre = 'OPERACIONES'
  AND NOT EXISTS (
      SELECT 1
      FROM rh_puestos p
      WHERE p.nombre = 'CHOFER'
  );

WITH chofer_puesto AS (
    SELECT p.id
    FROM rh_puestos p
    LEFT JOIN rh_departamentos d ON d.id = p.departamento_id
    WHERE p.nombre = 'CHOFER'
    ORDER BY
        CASE WHEN d.nombre = 'OPERACIONES' THEN 0 ELSE 1 END,
        p.id
    LIMIT 1
)
INSERT INTO rh_empleados (
    id,
    nombre,
    apellidos,
    puesto_id,
    correo_empresa,
    celular_empresa,
    estado
)
VALUES
    (
        '0005',
        'VICTOR',
        'MANUEL FIERROS GARCIA',
        (SELECT id FROM chofer_puesto),
        'fierrosv916@gmail.com',
        '5584261124',
        'Activo'
    ),
    (
        '0007',
        'ROGELIO',
        'PAUL VELAZQUEZ',
        (SELECT id FROM chofer_puesto),
        'chofertexcoco@gmail.com',
        '5584957361',
        'Activo'
    ),
    (
        '0010',
        'ANTONIO',
        'ORTIZ FUERTE',
        (SELECT id FROM chofer_puesto),
        'antoniochofer28@gmail.com',
        '56 1057 4890',
        'Activo'
    ),
    (
        '0013',
        'PABLO',
        'MISAEL PORTUGUEZ PINEDA',
        (SELECT id FROM chofer_puesto),
        NULL,
        '5575232116',
        'Activo'
    )
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    apellidos = EXCLUDED.apellidos,
    puesto_id = EXCLUDED.puesto_id,
    correo_empresa = EXCLUDED.correo_empresa,
    celular_empresa = EXCLUDED.celular_empresa,
    estado = EXCLUDED.estado;

COMMIT;
