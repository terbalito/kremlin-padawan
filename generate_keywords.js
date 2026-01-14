const fs = require('fs');
const path = require('path');

const fichierSource = path.join(__dirname, 'questions.json');
const fichierSortie = path.join(__dirname, 'questions_keywords.json');

const stopWords = [
  'le','la','les','de','du','des','un','une','et','en','à','au','aux',
  'pour','que','qui','dans','ce','cette','ces','est','il','elle','sur',
  'par','se','sa','son','a','ne','pas','plus','ou','d','l','qu'
];

// Fonction pour nettoyer le texte
function nettoyerTexte(texte) {
  return texte
    .replace(/REPONSE\s*:/gi, '')       // retirer 'REPONSE :'
    .replace(/[\r\n]/g, ' ')           // remplacer retours ligne par espace
    .replace(/[✓•]/g, '')               // retirer caractères spéciaux
    .replace(/\s+/g, ' ')               // supprimer espaces multiples
    .trim()
    .toLowerCase();
}

// Fonction pour extraire des mots-clés propres
function extraireMotsCles(texte) {
  const mots = texte.split(' ').map(m => 
    m.replace(/^[.,;:!?'"\\]+|[.,;:!?'"\\]+$/g, '') // retire ponctuation autour du mot
  );

  const motsCles = [...new Set(
    mots.filter(m => m.length > 2 && !stopWords.includes(m))
  )];

  return motsCles;
}

fs.readFile(fichierSource, 'utf8', (err, data) => {
  if (err) return console.error('Erreur lecture fichier :', err);

  let questions;
  try { questions = JSON.parse(data); } 
  catch (parseErr) { return console.error('Erreur parse JSON :', parseErr); }

  questions = questions.map(q => {
    const texteNettoye = nettoyerTexte(q.reponse);
    const motsCles = extraireMotsCles(texteNettoye);

    return {
      ...q,
      reponse: q.reponse.replace(/REPONSE\s*:/gi, '').replace(/[\r\n]+/g, ' ').trim(),
      motsCles
    };
  });

  fs.writeFile(fichierSortie, JSON.stringify(questions, null, 2), 'utf8', err => {
    if (err) console.error('Erreur écriture fichier :', err);
    else console.log(`✅ Mots-clés propres générés pour ${questions.length} questions : ${fichierSortie}`);
  });
});
