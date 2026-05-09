-- =========================================================
-- VOLCADO DE DATOS RH COMPLETO
-- Generado: 8/5/2026, 10:54:39 a.m.
-- =========================================================

-- 1. TURNOS
INSERT INTO rh_turnos (id, nombre, hora_entrada, hora_salida, tolerancia_minutos) 
VALUES (3, 'Matutino Estándar', NULL, NULL, 10) 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 2. PUESTOS
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (283, 'CEO', 1, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (284, 'SOCIOS FUNDADORES', 1, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (285, 'AUXILIAR CONTABLE (ESPECIALISTA)', 2, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (286, 'PROCESOS Y ATENCION AL CLIENTE', 3, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (287, 'EJECUTIVO DE VENTAS', 4, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (288, 'CHOFER', 4, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (289, 'RESPONSABLE INGENIERIA OPERATIVA', 5, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (290, 'INNOVACION Y DISEÑO', 5, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (291, 'INNOVACION Y DIGITALIZACION', 5, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (292, 'PROGRAMACION Y DESARROLLO', 5, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (293, 'MARKETING Y PUBLICIDAD (RESPONSABLE)', 6, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (294, 'RESPONSABLE INTENDENCIA', 7, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (295, 'JEFE DE PLANTA', 8, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (296, 'ENCARGADO DE MANUFACTURA', 8, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (297, 'AYUDANTE GENERAL', 8, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (298, 'CORTADOR', 8, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (299, 'TROQUELADOR', 8, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (300, 'ENCARGADO DE ALMACEN', 9, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (301, 'MONTACARGUISTA', 9, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (302, 'AUXILIAR DE ALMACEN', 9, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (303, 'ENCARGADO DE PINTURA', 10, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (304, 'AUXILIAR DE PINTURA', 10, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (305, 'ENCARGADO DE SOLDADURA', 11, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (306, 'SOLDADOR', 11, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (307, 'ENCARGADO DE LOGISTICA', 12, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (308, 'OPERADOR', 12, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (309, 'JEFE DE VIGILANCIA', 13, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (310, 'SEGURIDAD', 13, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (311, 'LIMPIEZA', 14, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (312, 'SEGURIDAD E HIGIENE', 15, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (313, 'CALIDAD', 15, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (315, 'INGENIERO INDUSTRIAL', NULL, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (314, 'AYUDANTE GENERAL', NULL, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
INSERT INTO rh_puestos (id, nombre, departamento_id, sueldo_base, estatus) 
VALUES (316, 'CHOFER', NULL, 0, 'Activo') 
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 3. EMPLEADOS
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0044', 'ABRAHAM', 'MENDEZ HERNANDEZ', '1993-01-27', 'MEHA930127HDFNRB08', 'MEHA930127T18', NULL, NULL, NULL, NULL, 'Activo', NULL, NULL, 'EXTERNO') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0003', 'BRYAN', 'TORRES RODRIGUEZ', '2000-10-13', 'TORB001013HDFRDRA0', 'TORB-001013-7IA', 283, NULL, '2018-11-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0002', 'GRACIELA', 'RODRIGUEZ VALDES', '1963-10-06', 'ROVG631006MMNDLR09', 'ROVG-631006-H22', 284, NULL, '2018-02-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0018', 'ROSA', 'HELENA SANCHEZ MARTINEZ', '1990-01-23', 'SAMR900123MMCNRS06', 'SAMR-900123-SQ7', 285, NULL, '2024-10-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0006', 'AMERICA', 'GEORGINA LAGUNA DIAZ', '1979-10-22', 'LADA791022MDFGZM02', 'LADA-791022-D60', 286, NULL, '2022-01-16', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0001', 'MA', 'DE LA PAZ HERNANDEZ ISLAS', '1966-01-24', 'HEIP660124MTLRSZ11', 'HEIM-660124-PG5', 294, NULL, '2018-01-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0030', 'SANDRA', 'VILLAVICENCIO CORTES', '1973-08-10', 'VICS730810MDFLRN03', 'VICS-730810-GI9', 287, NULL, '2025-12-16', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0023', 'KARLA', 'ALINE JUAREZ RIOS', '1995-12-25', 'JURK951225MDFRSR06', 'JURK-951225-MM1', 287, NULL, '2025-03-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0005', 'VICTOR', 'MANUEL FIERROS GARCIA', '1972-09-08', 'FIGV720908HDFRRC08', 'FIGV-720908-2A2', 288, NULL, '2022-01-16', NULL, 'Activo', 'humbertare0214@outlook.com', '5524134274', 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0010', 'ANTONIO', 'ORTIZ FUERTE', '1981-08-02', 'OIFA810802HMCRRN00', 'OIFA-810802-IF8', 288, NULL, '2022-05-16', NULL, 'Activo', 'antoniochofer28@gmail.com', '56 1057 4890', 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0015', 'NANCY', 'GUADALUPE ZARATE UTRILLA', '1996-02-06', 'ZAUN960206MDFRTN05', 'ZAUN-960206-LT5', 289, NULL, '2023-11-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0029', 'DULCE', 'YADIRA RAMOS MARQUEZ', '2001-01-24', 'RAMD010124MDFMRLA7', 'RAMD-010124-M57', 290, NULL, '2025-11-05', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0022', 'ELVIRA', 'NEGRETE RODRIGUEZ', NULL, NULL, NULL, 293, NULL, '2025-02-04', NULL, 'Activo', NULL, NULL, 'EXTERNO') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0008', 'SERGIO', 'RAMIREZ JUAREZ', '1995-10-08', 'RAJS951008HMCMRR04', 'RAJS-951008-BK5', 302, NULL, '2022-01-16', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0032', 'MARIA DE JESUS', 'MARTINEZ SIL', NULL, NULL, NULL, 297, NULL, '2026-02-03', NULL, 'Activo', NULL, NULL, 'EXTERNO') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0026', 'JONATHAN BRAYAN', 'ZAMBRANO FLORENCIO', '2003-11-20', 'ZAFJ031120HMCMLNA0', 'ZAFJ031120EV4', 291, NULL, '2025-07-09', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0013', 'PABLO', 'MISAEL PORTUGUEZ PINEDA', '2002-07-31', 'POPP020731HDFRNBA7', 'POPP-020731-8D9', 316, NULL, '2023-11-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0031', 'ISAAC YAHEL', 'LUNA HERNANDEZ', '2000-12-05', 'LUHI001205HMCNRSA8', NULL, NULL, NULL, '2026-01-05', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0033', 'ELOY EDUARDO', 'MIGUEL MARTINEZ', '2003-02-01', 'MIME030201HMCGRLA9', NULL, NULL, NULL, '2026-02-04', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0027', 'ARTURO', 'LOPEZ LOPEZ', '1983-05-25', 'LOLA830525HMCPPR00', 'LOLA8305254I3', NULL, NULL, '2025-09-01', NULL, 'Activo', NULL, NULL, 'EXTERNO') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0028', 'CARLOS', 'GOMEZ MORA', '1987-08-19', 'GOMC870819HMCMRR05', 'GOMC8708196H5', NULL, NULL, '2025-09-01', NULL, 'Activo', NULL, NULL, 'EXTERNO') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0025', 'HUMBERTO IRVING', 'ARRELLANO GONZALEZ', '2002-01-14', 'AEGH020114HMCRNMA8', NULL, 292, NULL, '2025-05-05', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0036', 'SALVADOR ALEJANDRO', 'HERNANDEZ CASTANEDA', '2001-04-24', 'HECS010424HMCRSLA5', NULL, 300, NULL, '2026-02-09', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0035', 'ANEL', 'FLORES HERRERA', '2003-12-20', 'FOHA031220MDFLRNA7', NULL, 300, NULL, '2026-02-09', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0024', 'DAVID', 'YAEL VAZQUEZ TRINIDAD', '2001-06-18', 'VATD010618HDFZRVA3', 'VATD-010618-SK6', 302, NULL, '2025-04-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0019', 'JUAN', 'FLORES RODRIGUEZ', '1966-03-27', 'FORJ660327HMCLDN06', 'FORJ-660327-721', 297, NULL, '2024-11-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0034', 'BRANDON FABIAN', 'MARES DE LA CRUZ', NULL, NULL, NULL, 297, NULL, '2026-02-06', NULL, 'Activo', NULL, NULL, 'EXTERNO') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0009', 'JAVIER', 'ALVARADO ASCENCIO', '1959-09-29', 'AAAJ590929HDFLSV12', 'AAAJ-590929-9K2', 298, NULL, '2022-05-16', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0020', 'PABLO', 'HERNANDEZ TEMPLOS', '1964-06-28', 'HETP640628HMCRMB09', 'HETP-640628-TI7', 299, NULL, '2024-11-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0012', 'BONIFACIO', 'CESAR BALDERAS RIVAS', '1974-06-05', 'BARB740605HMCLVN12', 'BARB-740605-9WA', 304, NULL, '2023-11-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0037', 'BRENDA JAQUELINE', 'LUZ ESPEJEL', '2003-10-14', 'LUEB031014MMCZSRA7', NULL, 312, NULL, '2026-02-09', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0038', 'JESUS DAVID', 'RAMALES MENDOZA', '2003-12-19', 'RAMJ031219HMCMNSA4', NULL, NULL, NULL, '2026-02-09', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0040', 'LEON YAIR', 'FRAGOSO ROMERO', '2002-08-20', 'FARL020820HDFRMNA9', NULL, NULL, NULL, '2026-02-09', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0016', 'JOHAN', 'JAFET ALVAREZ CERECEDO', '2001-07-15', 'AACJ010715HMCLRHA8', 'AACJ-010715-Q68', 295, NULL, '2024-02-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0014', 'EMILIO', 'ALEJANDRO SOLIS RAMIREZ', '2000-09-09', 'SORE000909HMCLMMA4', 'SORE-000909-D6A', 301, NULL, '2023-11-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0043', 'ANASTACIO', 'MARTINEZ SATURNINO', '1971-04-15', 'MASA710415HSPRTN06', 'MASA-710415-1E3', 296, NULL, '2026-03-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0004', 'ADRIAN', 'ZARCO SUSANO', '1979-03-05', 'ZASA790305HMCRSD08', 'ZASA-790305-TUA', 303, NULL, '2021-01-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0011', 'JAIME', 'JIMENEZ CRUZ', '1982-12-06', 'JICJ821206HMCMRM09', 'JICJ-821206-BE2', 305, NULL, '2023-01-02', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0007', 'ROGELIO', 'PAUL VELAZQUEZ', '1976-11-24', 'PAVR761124HMCLLG06', 'PAVR-761124-I63', 307, NULL, '2022-01-16', NULL, 'Activo', 'humbertare0214@outlook.com', '5524134274', 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0017', 'YUMKAX SANTIAGO', 'CANDELAS HERNANDEZ', NULL, NULL, NULL, 309, NULL, '2024-02-20', NULL, 'Activo', NULL, NULL, 'EXTERNO') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0021', 'JOSE', 'MIGUEL TRUJANO PINEDA', '1972-09-29', 'TUPM720929HMCRNG01', 'TUPM-720929-4X2', 310, NULL, '2024-11-01', NULL, 'Activo', NULL, NULL, 'PLANTA') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0041', 'KAREN ITZEL', 'GONZALEZ ANGELES', '2003-06-01', 'GOAK030601MDFNNRA5', NULL, 312, NULL, '2026-02-09', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0042', 'MARIA FERNANDA', 'MENDEZ JUAREZ', '2001-04-16', 'MEJF010416MPLNRRA1', NULL, 313, NULL, '2026-02-09', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado, correo_empresa, celular_empresa, tipo_empleado) 
VALUES ('0039', 'JUAN ANGEL', 'OSEGUERA MALDONADO', '2001-10-11', 'OEMJ011011HDFSLNA6', NULL, 313, NULL, '2026-02-09', NULL, 'Activo', NULL, NULL, 'RESIDENTE') 
ON CONFLICT (id) DO NOTHING;

-- 4. NOMINA
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0001', '88-86-66-1369-3', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0002', '20-07-63-0028-2', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0003', '01-18-00-6494-9', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0004', '96-05-79-0505-9', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0005', '20-94-72-0185-9', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0006', '39-95-79-6136-8', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0007', '07-94-76-2053-5', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0008', '59-14-95-8169-2', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'DETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0009', '10-78-59-0991-1', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0010', '20-01-81-1078-1', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0011', '01-02-82-1488-8', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0012', '96-99-74-0373-6', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0014', '16-16-00-8683-7', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'DETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0015', '96-15-96-0060-8', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0016', '44-16-01-7271-2', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0018', '96-09-89-4122-0', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0019', '02-19-66-6134-8', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0020', '10-81-64-8329-0', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0021', '96-04-72-0018-1', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0022', NULL, NULL, 'DE LEY', 0.00, 0.00, '', '', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0023', '01-16-95-2785-8', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0024', '10-13-01-6973-2', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0025', '01170239782', NULL, 'DE LEY', 0.00, 0.00, 'null', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0027', '96058311695', NULL, 'DE LEY', 0.00, 0.00, 'null', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0028', '96058757848', NULL, 'DE LEY', 0.00, 0.00, 'null', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0029', '52-19-01-1092-5', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0030', '28-91-73-2107-8', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0031', '75160077139', NULL, 'DE LEY', 0.00, 0.00, 'null', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0043', '20-04-71-0137-1', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0044', '28129315561', NULL, 'DE LEY', 0.00, 0.00, 'null', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0026', '58170339020', NULL, 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato, num_nomina) 
VALUES ('0013', '26-16-02-0584-0', 'Y56-49369-10-4', 'DE LEY', 0.00, 0.00, 'NOMINA QUINCENAL', 'INDETERMINADO', NULL) 
ON CONFLICT (empleado_id) DO NOTHING;

-- 5. DETALLES
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0001', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0026', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0013', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0002', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0003', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0004', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0005', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0006', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0007', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0008', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0009', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0010', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0011', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0012', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0014', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0015', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0016', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0018', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0019', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0020', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0021', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0022', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0023', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0024', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0029', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0030', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia) 
VALUES ('0043', NULL, NULL, NULL, NULL) 
ON CONFLICT (empleado_id) DO NOTHING;
