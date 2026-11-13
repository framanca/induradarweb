import fs from 'node:fs/promises';
import XLSX from 'xlsx';
import {workbookFromApprovedJson} from '../site/report/engine-report.mjs';

const [input,output] = process.argv.slice(2);
if (!input || !output) throw new Error('Uso: node scripts/render_engine_report.mjs JSON_APROBADO SALIDA.xlsx');
const report=JSON.parse(await fs.readFile(input,'utf8'));
await fs.writeFile(output,workbookFromApprovedJson(XLSX,report));
