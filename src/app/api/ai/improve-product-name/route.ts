import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { productName } = await request.json();

    if (!productName) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY is missing");
      return NextResponse.json({ improvedName: productName });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Optional OpenRouter attribution headers (see .env.example).
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": process.env.APP_TITLE || "Scan Peremption",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-nemo",
        messages: [
          {
            role: "system",
            content: "Tu es un assistant expert en nettoyage de noms de produits alimentaires. Ta tâche est de reformater le nom fourni pour qu'il soit propre, concis et bien lisible (Première lettre en majuscule, le reste en minuscule sauf noms propres). Enlève les poids (500g, 1L), les codes inutiles, les marques et les répétitions. Réponds UNIQUEMENT par le nom corrigé, sans guillemets ni explications. Exemple de réponse : 'Cordon bleu', 'Ketchup', 'Lardons', 'Pate brisée'"
          },
          {
            role: "user",
            content: `Nettoie ce nom de produit : "${productName}"`
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("OpenRouter API error:", await response.text());
      return NextResponse.json({ improvedName: productName });
    }

    const data = await response.json();
    const improvedName = data.choices?.[0]?.message?.content?.trim() || productName;

    return NextResponse.json({ improvedName });
  } catch (error) {
    console.error("Error improving product name:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
