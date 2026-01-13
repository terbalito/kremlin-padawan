function genererMotsCles(texte) {
  return [...new Set(
    texte
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(" ")
      .filter(mot =>
        mot.length > 5 &&
        !["article", "travail", "droit", "code", "loi"].includes(mot)
      )
  )].slice(0, 6);
}
