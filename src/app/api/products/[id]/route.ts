import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rememberName } from "@/lib/known-products";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json(product);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Produit non trouvé" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la suppression du produit" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { productName, expirationDate } = body;

    if (productName === undefined && expirationDate === undefined) {
      return NextResponse.json(
        { error: "Aucun champ à modifier" },
        { status: 400 }
      );
    }

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          productName,
          expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        },
      });
      if (typeof productName === "string") {
        await rememberName(tx, updated.barcode, productName);
      }
      return updated;
    });

    return NextResponse.json(product);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Produit non trouvé" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la modification du produit" },
      { status: 500 }
    );
  }
}
