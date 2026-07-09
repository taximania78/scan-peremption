import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        productName: true,
        expirationDate: true,
      },
      orderBy: {
        expirationDate: "asc",
      },
    });

    return NextResponse.json(products);
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la liste des produits" },
      { status: 500 }
    );
  }
}
