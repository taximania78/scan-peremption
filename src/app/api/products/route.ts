import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rememberName } from "@/lib/known-products";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barcode, productName, expirationDate } = body;

    if (!barcode || !productName || !expirationDate) {
      return NextResponse.json(
        { error: "Champs requis manquants" },
        { status: 400 }
      );
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          barcode,
          productName,
          expirationDate: new Date(expirationDate),
        },
      });
      await rememberName(tx, barcode, productName);
      return created;
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Ce code-barres existe déjà" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement du produit" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { expirationDate: "asc" },
    });

    return NextResponse.json(products);
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la récupération des produits" },
      { status: 500 }
    );
  }
}
