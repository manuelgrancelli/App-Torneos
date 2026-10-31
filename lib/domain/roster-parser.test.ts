import { describe, expect, it } from "vitest";
import {
  cleanHeaderFormatting,
  extractNumberedPlayers,
  isCategoryHeader,
  isFootballCategoryHeader,
  isFootballSport,
  parseBulkRoster,
  parseFootballRoster,
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
    expect(isCategoryHeader("1- López Martín / Díaz Franco")).toBe(false);
    expect(isCategoryHeader("12-")).toBe(false);
  });

  it("parsea líneas de parejas con distintos separadores y descarta líneas vacías", () => {
    const p1 = parsePairLine("1- López Martín / Díaz Franco");
    expect(p1).toEqual({
      playerNames: ["López Martín", "Díaz Franco"],
      teamName: "López Martín / Díaz Franco",
    });

    const p2 = parsePairLine("2- Herrera Tomás - Ruiz Mateo");
    expect(p2).toEqual({
      playerNames: ["Herrera Tomás", "Ruiz Mateo"],
      teamName: "Herrera Tomás / Ruiz Mateo",
    });

    const p3 = parsePairLine("3. Sosa Julián y Peralta Nicolás");
    expect(p3).toEqual({
      playerNames: ["Sosa Julián", "Peralta Nicolás"],
      teamName: "Sosa Julián / Peralta Nicolás",
    });

    // Líneas vacías tipo números sin jugadores
    expect(parsePairLine("12-")).toBeNull();
    expect(parsePairLine("13- \t")).toBeNull();
    expect(parsePairLine("")).toBeNull();
  });

  it("parsea una lista de WhatsApp con múltiples categorías", () => {
    const rawText = `*22/23/24 y 25*

*➡️ Suma 10 Caballeros* 

1- López Martín / Díaz Franco
2- Herrera Tomás / Ruiz Mateo 
3- Sosa Julián / Peralta Nicolás
4- Castro Emiliano / Romero Agustín
5- Delgado Facundo / Vega Luciano
6- Molina Luis / Paz Agustín
7- Núñez Héctor / Silva Gonzalo
8- Ríos Christian / Aguirre Gustavo
9- Torres Franco / Medina Santino
10- Giménez Matías / Acosta Gabriel
11- Córdoba Emanuel / Ledesma Elian
12-
13-
14-
15-

*➡️ 6ta Caballeros* 

1- Varela Gonzalo / Ibáñez Rodrigo
2- Navarro Leonardo / Quiroga Oscar 
3- Campos Bautista / Ojeda Nahuel 
4- Vera José / Flores Leandro
5- Luna Brian / Morales Mariano
6- Godoy Emir / Páez Tomás
7- Figueroa Ramiro / Benítez Marcelo
8- Cabrera Gustavo / Duarte Gonzalo
9- Miranda Luis / Guzmán Gustavo
10-
11-
12-
13-
14-
15-

*➡️ Suma 13 Damas*

1- Ortiz Nadia / Suárez Nadia	
2- Ramos Valeria / Bustos Silvina	
3- Villalba Natalia / Cáceres Giuliana	
4- Ferreyra Eliana / Domínguez Yohanna	
5- Ávila Ailyn / Cardozo Marcia	
6- Escobar Ariadna / Lucero Yohana	
7- Montoya Antonella / Mansilla Rocío	
8- Gallardo Delfina / Ponce Agostina 	
9- Carrizo Jazmín / Toledo Valentina	
10- Bravo Emilia / Roldán Jesica	
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
    expect(cat1.teams[0]!.teamName).toBe("López Martín / Díaz Franco");
    expect(cat1.teams[10]!.teamName).toBe("Córdoba Emanuel / Ledesma Elian");

    // Categoría 2: 6ta Caballeros (nueva categoría)
    const cat2 = result.categories[1]!;
    expect(cat2.categoryName).toBe("6ta Caballeros");
    expect(cat2.matchedCategoryId).toBeNull();
    expect(cat2.teams).toHaveLength(9);
    expect(cat2.teams[0]!.teamName).toBe("Varela Gonzalo / Ibáñez Rodrigo");
    expect(cat2.teams[8]!.teamName).toBe("Miranda Luis / Guzmán Gustavo");

    // Categoría 3: Suma 13 Damas (nueva categoría)
    const cat3 = result.categories[2]!;
    expect(cat3.categoryName).toBe("Suma 13 Damas");
    expect(cat3.matchedCategoryId).toBeNull();
    expect(cat3.teams).toHaveLength(10);
    expect(cat3.teams[0]!.teamName).toBe("Ortiz Nadia / Suárez Nadia");
    expect(cat3.teams[9]!.teamName).toBe("Bravo Emilia / Roldán Jesica");

    // Las líneas vacías como 12-, 13-, etc. fueron ignoradas correctamente
    expect(result.ignoredLines).toContain("12-");
    expect(result.ignoredLines).toContain("13-");
    expect(result.ignoredLines).toContain("*22/23/24 y 25*");
  });

  it("reconoce '5TA Caballeros' como la misma categoría que '5ta caballreos' existente", () => {
    const rawText = `*➡️ 5TA Caballeros*

1- López Martín / Díaz Franco
2- Herrera Tomás / Ruiz Mateo`;

    const existingCategories = [
      { id: "cat-5ta", name: "5ta caballreos" },
    ];

    const result = parseBulkRoster(rawText, existingCategories);

    expect(result.categories).toHaveLength(1);
    const cat = result.categories[0]!;
    expect(cat.matchedCategoryId).toBe("cat-5ta");
    expect(cat.teams).toHaveLength(2);
  });
  describe("fútbol - roster-parser", () => {
    it("detecta identificadores de fútbol con isFootballSport", () => {
      expect(isFootballSport("futbol")).toBe(true);
      expect(isFootballSport("futbol-11")).toBe(true);
      expect(isFootballSport("futbol-5")).toBe(true);
      expect(isFootballSport("soccer")).toBe(true);
      expect(isFootballSport("padel")).toBe(false);
      expect(isFootballSport("tenis")).toBe(false);
      expect(isFootballSport(null)).toBe(false);
      expect(isFootballSport(undefined)).toBe(false);
    });

    it("extrae jugadores numerados en una sola línea o en renglones", () => {
      // Formato inline tipo "1-Montero 2- Dillollo 3- Blanco etc"
      const inline = extractNumberedPlayers("1-Montero 2- Dillollo 3- Blanco etc");
      expect(inline).toEqual(["Montero", "Dillollo", "Blanco"]);

      // Formato renglón individual
      expect(extractNumberedPlayers("1- Montero")).toEqual(["Montero"]);
      expect(extractNumberedPlayers("2. Di Lollo")).toEqual(["Di Lollo"]);
      expect(extractNumberedPlayers("3) Blanco")).toEqual(["Blanco"]);
      expect(extractNumberedPlayers("• Lucas Romero")).toEqual(["Lucas Romero"]);
    });

    it("detecta encabezados de categoría específicos para fútbol", () => {
      expect(isFootballCategoryHeader("*➡️ Categoría Libres*")).toBe(true);
      expect(isFootballCategoryHeader("Categoría +35")).toBe(true);
      expect(isFootballCategoryHeader("Zona A")).toBe(true);
      expect(isFootballCategoryHeader("+30")).toBe(true);
      expect(isFootballCategoryHeader("Libres")).toBe(true);
      expect(isFootballCategoryHeader("Senior")).toBe(true);

      // No confunde nombres de equipos ni jugadores
      expect(isFootballCategoryHeader("Los Galácticos FC")).toBe(false);
      expect(isFootballCategoryHeader("1- Lucas Benítez")).toBe(false);
      expect(isFootballCategoryHeader("1. Julián Peralta")).toBe(false);
    });

    it("parsea equipos de fútbol con jugadores en renglones debajo del nombre del equipo", () => {
      const rawText = `Los Galácticos FC
1- Lucas Benítez
2- Matías Morales
3- Franco Navarro

El Rejunte FC
1- Julián Peralta
2- Nicolás Romero
3- Emiliano Gómez`;

      const result = parseFootballRoster(rawText);

      expect(result.categories).toHaveLength(1);
      expect(result.totalTeams).toBe(2);

      const team1 = result.categories[0]!.teams[0]!;
      expect(team1.teamName).toBe("Los Galácticos FC");
      expect(team1.playerNames).toEqual(["Lucas Benítez", "Matías Morales", "Franco Navarro"]);

      const team2 = result.categories[0]!.teams[1]!;
      expect(team2.teamName).toBe("El Rejunte FC");
      expect(team2.playerNames).toEqual(["Julián Peralta", "Nicolás Romero", "Emiliano Gómez"]);
    });

    it("parsea el formato inline de la solicitud del usuario ('Los Galácticos 1-Lucas Benítez 2- Matías Morales 3- Franco Navarro etc')", () => {
      const rawText = `Los Galácticos 1-Lucas Benítez 2- Matías Morales 3- Franco Navarro etc
El Rejunte: 1-Julián Peralta 2-Nicolás Romero 3-Emiliano Gómez`;

      const result = parseFootballRoster(rawText);

      expect(result.categories).toHaveLength(1);
      expect(result.totalTeams).toBe(2);

      const team1 = result.categories[0]!.teams[0]!;
      expect(team1.teamName).toBe("Los Galácticos");
      expect(team1.playerNames).toEqual(["Lucas Benítez", "Matías Morales", "Franco Navarro"]);

      const team2 = result.categories[0]!.teams[1]!;
      expect(team2.teamName).toBe("El Rejunte");
      expect(team2.playerNames).toEqual(["Julián Peralta", "Nicolás Romero", "Emiliano Gómez"]);
    });

    it("soporta equipos con numeración en el título y listas de jugadores", () => {
      const rawText = `1. Los Galácticos
1- Juan Pérez
2- Carlos López
3- Martín Gómez

2. La Scaloneta
1- Leo Messi
2- Dibu Martínez
3- Cuti Romero`;

      const result = parseFootballRoster(rawText);

      expect(result.categories).toHaveLength(1);
      expect(result.totalTeams).toBe(2);

      expect(result.categories[0]!.teams[0]!.teamName).toBe("Los Galácticos");
      expect(result.categories[0]!.teams[0]!.playerNames).toEqual([
        "Juan Pérez",
        "Carlos López",
        "Martín Gómez",
      ]);

      expect(result.categories[0]!.teams[1]!.teamName).toBe("La Scaloneta");
      expect(result.categories[0]!.teams[1]!.playerNames).toEqual([
        "Leo Messi",
        "Dibu Martínez",
        "Cuti Romero",
      ]);
    });

    it("enruta automáticamente a través de parseBulkRoster pasando sportId", () => {
      const footballText = `*➡️ Libres*
Los Galácticos FC
1- Lucas Benítez
2- Matías Morales
3- Franco Navarro`;

      const existingCats = [{ id: "cat-libres", name: "Libres" }];

      const result = parseBulkRoster(footballText, existingCats, { sportId: "futbol" });

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0]!.matchedCategoryId).toBe("cat-libres");
      expect(result.categories[0]!.teams[0]!.teamName).toBe("Los Galácticos FC");
      expect(result.categories[0]!.teams[0]!.playerNames).toEqual(["Lucas Benítez", "Matías Morales", "Franco Navarro"]);
    });
  });
});
