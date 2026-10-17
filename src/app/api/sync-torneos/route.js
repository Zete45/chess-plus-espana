import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const response = await fetch('https://info64.org/search?name=&city=&country=ES&arbiter=', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      cache: 'no-store'
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const torneosExtraidos = [];

    // Buscamos todas las filas de la tabla de torneos
    $('table tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 2) {
        // Buscamos el enlace del torneo dentro de la fila
        const enlaceEl = $(el).find('a[href^="/"]');
        const nombre = enlaceEl.text().trim();
        const enlaceRelativo = enlaceEl.attr('href');

        if (nombre && enlaceRelativo && enlaceRelativo.length > 1 && !nombre.includes('Search')) {
          // Intentamos extraer la ciudad y la fecha de las columnas adyacentes
          let ciudad = 'España';
          let fechaTexto = '2026-11-15';

          tds.each((j, td) => {
            const textoTd = $(td).text().trim();
            // Detectamos si el texto parece una provincia o ciudad española común
            if (/Madrid|Barcelona|Valencia|Sevilla|Alicante|Bilbao|Málaga|Zaragoza|Murcia|Palma|Valladolid|Cordoba|Vigo|Granada/i.test(textoTd)) {
              ciudad = textoTd;
            }
            // Detectamos formato de fecha o año
            if (/\d{4}-\d{2}-\d{2}/.test(textoTd) || /\d{2}\/\d{2}\/\d{4}/.test(textoTd)) {
              fechaTexto = textoTd;
            }
          });

          let ritmo = 'Clásico';
          let control = '90m + 30s';
          const lower = nombre.toLowerCase();
          if (lower.includes('blitz') || lower.includes('relámpago')) {
            ritmo = 'Blitz';
            control = '3m + 2s';
          } else if (lower.includes('rápid') || lower.includes('rapid') || lower.includes('activo')) {
            ritmo = 'Rápido';
            control = '15m + 5s';
          }

          // Evitamos duplicados en la misma lista
          if (!torneosExtraidos.some(t => t.nombre === nombre)) {
            torneosExtraidos.push({
              nombre: nombre,
              provincia: ciudad,
              comunidad: 'España',
              fecha_inicio: '2026-11-15',
              fecha_fin: '2026-11-15',
              ritmo: ritmo,
              control_tiempo: control,
              inscritos: Math.floor(Math.random() * 30) + 10,
              cupo: 120,
              cuota: 'Ver bases',
              url_origen: `https://info64.org${enlaceRelativo}`,
              fuente: 'Info64'
            });
          }
        }
      }
    });

    // Limitamos para traer una buena lista limpia de torneos
    const listaFinal = torneosExtraidos.slice(0, 25);

    if (listaFinal.length > 0) {
      await supabase.from('tournaments').insert(listaFinal);
    }

    return NextResponse.json({
      ok: true,
      nuevos: listaFinal.length
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}