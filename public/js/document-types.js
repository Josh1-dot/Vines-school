export const documentTypes=['CV','Identity document','Contract','Diploma','Other'];
// Existing stored categories remain readable without rewriting staff records.
const legacyTypes={'Identité':'Identity document','Contrat':'Contract','Diplôme':'Diploma','Autre':'Other'};
export const documentTypeLabel=value=>legacyTypes[value]||value;
