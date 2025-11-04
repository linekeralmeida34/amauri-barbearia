// Lista de bairros de João Pessoa, Paraíba
export const joaoPessoaNeighborhoods = [
  "Alto do Mateus",
  "Anatólia",
  "Bairro dos Estados",
  "Barra de Gramame",
  "Barra de Ouro",
  "Bessa",
  "Cabo Branco",
  "Centro",
  "Cidade dos Colibris",
  "Costa do Sol",
  "Cristo Redentor",
  "Cruz das Armas",
  "Distrito Industrial",
  "Ernani Sátiro",
  "Expedicionários",
  "Funcionários",
  "Ilha do Bispo",
  "Ipês",
  "Jardim Cidade Universitária",
  "Jardim Luna",
  "Jardim São Paulo",
  "Jardim Veneza",
  "Jaguaribe",
  "José Américo",
  "Mandacaru",
  "Mangabeira",
  "Manaíra",
  "Muçumagro",
  "Novo Mangabeira",
  "Oitizeiro",
  "Padre Zé",
  "Paratibe",
  "Pedro Gondim",
  "Penha",
  "Planalto Boa Esperança",
  "Portal do Sol",
  "Rangel",
  "Róger",
  "Santa Rosa",
  "São José",
  "Tambauzinho",
  "Tambiá",
  "Torre",
  "Trapiche da Barra",
  "Trincheiras",
  "Valentina",
  "Varadouro",
  "Vila dos Comerciários",
  "Vila dos Pescadores",
];

// Função para buscar bairros por termo (case-insensitive)
export function searchNeighborhoods(term: string): string[] {
  if (!term.trim()) return joaoPessoaNeighborhoods;
  
  const lowerTerm = term.toLowerCase().trim();
  return joaoPessoaNeighborhoods.filter((neighborhood) =>
    neighborhood.toLowerCase().includes(lowerTerm)
  );
}

