const natural = require('natural');
const stemmer = natural.PorterStemmerFr;

const mots = ["inspecteur", "inspection", "travailleurs", "travail", "travailleur"];
mots.forEach(m => {
    console.log(`${m} → ${stemmer.stem(m)}`);
});