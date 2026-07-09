import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ barcode: string }> }
) {
  const { barcode } = await params;

  try {
    // Open Food Facts requires a custom User-Agent: AppName/Version (Contact).
    // Configurable so deployers can set their own contact (see .env.example).
    const userAgent =
      process.env.OFF_USER_AGENT ||
      "ScanPeremption/1.0 (https://github.com/your-org/scan-peremption)";

    const response = await fetch(
      `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(
        barcode
      )}?fields=product_name,product_name_fr,code,image_front_url`,
      {
        headers: {
          "User-Agent": userAgent,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Produit non trouvé" },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.status !== "success" || !data.product) {
      return NextResponse.json(
        { error: "Produit non trouvé dans Open Food Facts" },
        { status: 404 }
      );
    }

    const product = {
      name:
        data.product.product_name_fr ||
        data.product.product_name ||
        "Nom inconnu",
      barcode: data.product.code,
      image_url: data.product.image_front_url || null,
    };

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product from OpenFoodFacts:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du produit" },
      { status: 500 }
    );
  }
}
