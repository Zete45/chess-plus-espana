import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fideId = searchParams.get("id");

  if (!fideId) {
    return NextResponse.json({ ok: false, error: "Falta ID" }, { status: 400 });
  }

  try {
    const response = await fetch("https://ratings.fide.com/profile/" + fideId, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    const titulo = $(".player-title-container").text().trim();
    const h1 = $("h1").first().text().trim();
    const nombre = titulo || h1;

    if (!nombre || nombre.includes("Not Found")) {
      return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });
    }

    const texto = $("body").text();
    
    // Expresiones regulares robustas para capturar Standard, Rapid y Blitz
    const stdMatch = texto.match(/std\D*(\d{3,4})/i) || texto.match(/standard\D*(\d{3,4})/i);
    const rapidMatch = texto.match(/rap\D*(\d{3,4})/i) || texto.match(/rapid\D*(\d{3,4})/i);
    const blitzMatch = texto.match(/blz\D*(\d{3,4})/i) || texto.match(/blitz\D*(\d{3,4})/i);

    return NextResponse.json({
      ok: true,
      jugador: {
        fideId: fideId,
        nombre: nombre.replace(/\s+/g, " "),
        eloStd: stdMatch ? parseInt(stdMatch[1], 10) : 0,
        eloRapid: rapidMatch ? parseInt(rapidMatch[1], 10) : 0,
        eloBlitz: blitzMatch ? parseInt(blitzMatch[1], 10) : 0
      }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Error FIDE" }, { status: 500 });
  }
}