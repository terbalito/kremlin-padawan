const fs = require('fs');
const path = require('path');

// 📁 Ton fichier texte OCR
const inputFile = path.join(__dirname, 'questions.txt');
const outputFile = path.join(__dirname, 'questions.json');

// Lire le fichier texte
const data = fs.readFileSync(inputFile, 'utf-8');

// Séparer les questions par un pattern qui détecte les numéros suivi de '.'
const regexQuestions = /(\d+)\.\s([\s\S]*?)(?=(\n\d+\.|\n*$))/g;

let idCounter = 1;
const questionsArray = [];

let match;
while ((match = regexQuestions.exec(data)) !== null) {
  let numero = match[1];         // le numéro de la question
  let content = match[2].trim(); // le texte de la question + réponse

  // Séparer la question de la réponse
  let [questionPart, ...reponseParts] = content.split(/REPONSE\s*:/i);
  let questionText = questionPart.trim().replace(/\n/g, '\\n');
  let reponseText = reponseParts.join('REPONSE :').trim().replace(/(\n|}),?$/g, '').replace(/\n/g, '\\n');

  // Créer l'objet JSON
  questionsArray.push({
    id: idCounter++,
    question: questionText,
    reponse: reponseText,
    motsCles: []
  });
}

// Écrire le fichier JSON
fs.writeFileSync(outputFile, JSON.stringify(questionsArray, null, 2), 'utf-8');

console.log(`✅ JSON généré avec ${questionsArray.length} questions : ${outputFile}`);
