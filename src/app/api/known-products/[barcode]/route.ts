import { NextRequest, NextResponse } from "next/server";
import { findKnownName } from "@/lib/known-products";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ barcode: string }> }
) {
  const { barcode } = await params;

  try {
    const name = await findKnownName(barcode);

    if (name === null) {
      return NextResponse.json(
        { error: "Produit inconnu" },
        { status: 404 }
      );
    }

    return NextResponse.json({ name });
  } catch (error) {
    console.error("Error reading known product:", error);
    return NextResponse.json(
      { error: "Erreur lors de la lecture des noms mémorisés" },
      { status: 500 }
    );
  }
}
