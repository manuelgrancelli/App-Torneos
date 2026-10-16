import { describe, expect, it } from "vitest";
import {
  cleanHeaderFormatting,
  isCategoryHeader,
  parseBulkRoster,
  parsePairLine,
} from "./roster-parser";

describe("roster-parser", () => {
  it("limpia el formato de encabezados de categoría", () => {
    expect(cleanHeaderFormatting("*➡️ Suma 10 Caballeros*")).toBe("Suma 10 Caballeros");
    expect(cleanHeaderFormatting("*➡️ 6ta Caballeros*")).toBe("6ta Caballeros");
    expect(cleanHeaderFormatting("➡️ Suma 13 Damas")).toBe("Suma 13 Damas");
    expect(cleanHeaderFormatting("*+10*")).toBe("+10");
  });

  it("detecta encabezados de categoría válidos e ignora notas de fechas", () => {
    expect(isCategoryHeader("*➡️ Suma 10 Caballeros*")).toBe(true);
    expect(isCategoryHeader("*➡️ 6ta Caballeros*")).toBe(true);
    expect(isCategoryHeader("*➡️ Suma 13 Damas*")).toBe(true);
    expect(isCategoryHeader("+10")).toBe(true);
    expect(isCategoryHeader("Categoría 7ma")).toBe(true);

    expect(isCategoryHeader("*22/23/24 y 25*")).toBe(false);
    expect(isCategoryHeader("1- Reynoso Luciano / Gimenez Alejandro")).toBe(false);
    expect(isCategoryHeader("12-")).toBe(false);
  });

  it("parsea líneas de parejas con distintos separadores y descarta líneas vacías", () => {
    const p1 = parsePairLine("1- Reynoso Luciano / Gimenez Alejandro");
    expect(p1).toEqual({
      playerNames: ["Reynoso Luciano", "Gimenez Alejandro"],
      teamName: "Reynoso Luciano / Gimenez Alejandro",
    });

    const p2 = parsePairLine("2- Gallo Brian - Kemmerer Hernán");
    expect(p2).toEqual({
      playerNames: ["Gallo Brian", "Kemmerer Hernán"],
      teamName: "Gallo Brian / Kemmerer Hernán",
    });

    const p3 = parsePairLine("3. Taulada Valentin y Taborda Fabricio");
    expect(p3).toEqual({
      playerNames: ["Taulada Valentin", "Taborda Fabricio"],
      teamName: "Taulada Valentin / Taborda Fabricio",
    });

    // Líneas vacías tipo números sin jugadores
    expect(parsePairLine("12-")).toBeNull();
    expect(parsePairLine("13- \t")).toBeNull();
    expect(parsePairLine("")).toBeNull();
  });

  it("parsea la lista real de WhatsApp provista por el usuario", () => {
    const rawText = `*22/23/24 y 25*

*➡️ Suma 10 Caballeros* 

1- Reynoso Luciano / Gimenez Alejandro
2- Gallo Brian / Kemmerer Hernán 
3- Taulada Valentin / Taborda Fabricio
4- Spessot Juan / Rodriguez Facundo
5- Masset Javier / Erbes Luciano
6- Albornoz Luis / Farias Agustin
7- Alva Hector / Thomas Gonzalvez
8- Befart Christian / Gallo Gustavo
9- Burne Franco / Terrarosa Santino
10- Arias Matías / Barrachini Gabriel
11- Moreira Emanuel / Montenegro Elian
12-
13-
14-
15-

*➡️ 6ta Caballeros* 

1- Ale Gonzalo / Grancelli Rodrigo
2- Wainz Leonardo / Zapata Oscar 
3- Medina Bautista / Figueroa Nahuel 
4- Gastaldo José / Blanc Leandro
5- Fleischmann Brian / Wendler Mariano
6- Jaime Emir / Retamar Tomas
7- Orieta Ramiro / Bugallo Marcelo
8- Parrone Gustavo / Grancelli Gonzalo
9- Mariano Luis / Romero Gustavo
10-
11-
12-
13-
14-
15-

*➡️ Suma 13 Damas*

1- Unrein Nadia / Frank Nadia	
2- Martinez Valeria / Mendez Silvina	
3- Zapata Natalia / Medina Giuliana	
4- Barbieri Eliana / Gallo Yohanna	
5- Paisel Ailyn / Tabares Marcia	
6- Peretti Ariadna / Frank Yohana	
7- Ocampos Antonella / Baez Rocio	
8- Saluzzio Delfina / Gallo Agostina 	
9- Albornoz Jazmín / Ré Valentina	
10- Almeida Emilia / Gabirondo Jesica	
11- 	
12-
13-
14-
15-`;

    const existingCategories = [
      { id: "cat-1", name: "Suma 10 Caballeros" },
      // 6ta y Suma 13 no existen previamente en esta prueba
    ];

    const result = parseBulkRoster(rawText, existingCategories);

    expect(result.categories).toHaveLength(3);
    expect(result.totalTeams).toBe(30); // 11 + 9 + 10 = 30

    // Categoría 1: Suma 10 Caballeros (vinculada con cat-1)
    const cat1 = result.categories[0]!;
    expect(cat1.categoryName).toBe("Suma 10 Caballeros");
    expect(cat1.matchedCategoryId).toBe("cat-1");
    expect(cat1.teams).toHaveLength(11);
    expect(cat1.teams[0]!.teamName).toBe("Reynoso Luciano / Gimenez Alejandro");
    expect(cat1.teams[10]!.teamName).toBe("Moreira Emanuel / Montenegro Elian");

    // Categoría 2: 6ta Caballeros (nueva categoría)
    const cat2 = result.categories[1]!;
    expect(cat2.categoryName).toBe("6ta Caballeros");
    expect(cat2.matchedCategoryId).toBeNull();
    expect(cat2.teams).toHaveLength(9);
    expect(cat2.teams[0]!.teamName).toBe("Ale Gonzalo / Grancelli Rodrigo");
    expect(cat2.teams[8]!.teamName).toBe("Mariano Luis / Romero Gustavo");

    // Categoría 3: Suma 13 Damas (nueva categoría)
    const cat3 = result.categories[2]!;
    expect(cat3.categoryName).toBe("Suma 13 Damas");
    expect(cat3.matchedCategoryId).toBeNull();
    expect(cat3.teams).toHaveLength(10);
    expect(cat3.teams[0]!.teamName).toBe("Unrein Nadia / Frank Nadia");
    expect(cat3.teams[9]!.teamName).toBe("Almeida Emilia / Gabirondo Jesica");

    // Las líneas vacías como 12-, 13-, etc. fueron ignoradas correctamente
    expect(result.ignoredLines).toContain("12-");
    expect(result.ignoredLines).toContain("13-");
    expect(result.ignoredLines).toContain("*22/23/24 y 25*");
  });
});
