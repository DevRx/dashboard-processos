// ─────────────────────────────────────────────────────────
// Domínio: municípios para o mapa de atendimento
//
// O cadastro guarda endereço como texto livre, então não há de onde
// tirar uma coordenada a não ser reconhecendo o município escrito ali.
// Esta tabela é o dicionário desse reconhecimento.
//
// A cobertura é a do escritório: as regiões administrativas do DF, as
// cidades do entorno e as capitais. Endereço de município fora da
// lista não vira pin — a tela junta esses clientes numa lista à parte
// para alguém apontar o lugar à mão. Ampliar é acrescentar linhas.
//
// Coordenadas são do centro da cidade, com 4 casas decimais (~11 m).
// Pin de município, não de porta: a tela responde "onde estamos
// atendendo", e para isso o endereço exato do titular não precisa sair
// do cadastro.
// ─────────────────────────────────────────────────────────

export type Municipio = {
  nome: string
  uf: string
  lat: number
  lng: number
}

export const MUNICIPIOS: readonly Municipio[] = [
  // Distrito Federal — regiões administrativas
  { nome: "Brasília", uf: "DF", lat: -15.7939, lng: -47.8828 },
  { nome: "Plano Piloto", uf: "DF", lat: -15.7939, lng: -47.8828 },
  { nome: "Gama", uf: "DF", lat: -16.0186, lng: -48.0664 },
  { nome: "Taguatinga", uf: "DF", lat: -15.8331, lng: -48.0575 },
  { nome: "Brazlândia", uf: "DF", lat: -15.6764, lng: -48.2011 },
  { nome: "Sobradinho", uf: "DF", lat: -15.6533, lng: -47.7908 },
  { nome: "Sobradinho II", uf: "DF", lat: -15.6519, lng: -47.8231 },
  { nome: "Planaltina", uf: "DF", lat: -15.6178, lng: -47.6531 },
  { nome: "Paranoá", uf: "DF", lat: -15.7736, lng: -47.7803 },
  { nome: "Núcleo Bandeirante", uf: "DF", lat: -15.8703, lng: -47.9689 },
  { nome: "Ceilândia", uf: "DF", lat: -15.8158, lng: -48.1097 },
  { nome: "Sol Nascente", uf: "DF", lat: -15.8306, lng: -48.1533 },
  { nome: "Guará", uf: "DF", lat: -15.8283, lng: -47.9819 },
  { nome: "Cruzeiro", uf: "DF", lat: -15.7889, lng: -47.9364 },
  { nome: "Samambaia", uf: "DF", lat: -15.8753, lng: -48.0839 },
  { nome: "Santa Maria", uf: "DF", lat: -16.0100, lng: -48.0231 },
  { nome: "São Sebastião", uf: "DF", lat: -15.9019, lng: -47.7789 },
  { nome: "Recanto das Emas", uf: "DF", lat: -15.9036, lng: -48.0619 },
  { nome: "Lago Sul", uf: "DF", lat: -15.8353, lng: -47.8683 },
  { nome: "Lago Norte", uf: "DF", lat: -15.7392, lng: -47.8394 },
  { nome: "Riacho Fundo", uf: "DF", lat: -15.8858, lng: -48.0217 },
  { nome: "Riacho Fundo II", uf: "DF", lat: -15.9006, lng: -48.0442 },
  { nome: "Candangolândia", uf: "DF", lat: -15.8517, lng: -47.9531 },
  { nome: "Águas Claras", uf: "DF", lat: -15.8386, lng: -48.0264 },
  { nome: "Vicente Pires", uf: "DF", lat: -15.8083, lng: -48.0264 },
  { nome: "Arniqueira", uf: "DF", lat: -15.8567, lng: -48.0342 },
  { nome: "Sudoeste", uf: "DF", lat: -15.7936, lng: -47.9264 },
  { nome: "Octogonal", uf: "DF", lat: -15.7936, lng: -47.9264 },
  { nome: "Varjão", uf: "DF", lat: -15.7139, lng: -47.8747 },
  { nome: "Park Way", uf: "DF", lat: -15.8869, lng: -47.9689 },
  { nome: "Estrutural", uf: "DF", lat: -15.7833, lng: -47.9958 },
  { nome: "SCIA", uf: "DF", lat: -15.7833, lng: -47.9958 },
  { nome: "Jardim Botânico", uf: "DF", lat: -15.8664, lng: -47.8028 },
  { nome: "Itapoã", uf: "DF", lat: -15.7519, lng: -47.7739 },
  { nome: "SIA", uf: "DF", lat: -15.8006, lng: -47.9578 },
  { nome: "Fercal", uf: "DF", lat: -15.5931, lng: -47.8792 },

  // Entorno do DF
  { nome: "Valparaíso de Goiás", uf: "GO", lat: -16.0656, lng: -47.9756 },
  { nome: "Luziânia", uf: "GO", lat: -16.2525, lng: -47.9503 },
  { nome: "Águas Lindas de Goiás", uf: "GO", lat: -15.7622, lng: -48.2803 },
  { nome: "Cidade Ocidental", uf: "GO", lat: -16.0733, lng: -47.9256 },
  { nome: "Novo Gama", uf: "GO", lat: -16.0347, lng: -48.0417 },
  { nome: "Santo Antônio do Descoberto", uf: "GO", lat: -15.9411, lng: -48.2606 },
  { nome: "Formosa", uf: "GO", lat: -15.5372, lng: -47.3344 },
  { nome: "Planaltina de Goiás", uf: "GO", lat: -15.4531, lng: -47.6142 },
  { nome: "Cristalina", uf: "GO", lat: -16.7675, lng: -47.6136 },
  { nome: "Padre Bernardo", uf: "GO", lat: -15.1631, lng: -48.2833 },
  { nome: "Alexânia", uf: "GO", lat: -16.0819, lng: -48.5069 },
  { nome: "Anápolis", uf: "GO", lat: -16.3267, lng: -48.9528 },
  { nome: "Unaí", uf: "MG", lat: -16.3575, lng: -46.9061 },
  { nome: "Buritis", uf: "MG", lat: -15.6194, lng: -46.4211 },

  // Capitais
  { nome: "Goiânia", uf: "GO", lat: -16.6869, lng: -49.2648 },
  { nome: "São Paulo", uf: "SP", lat: -23.5505, lng: -46.6333 },
  { nome: "Rio de Janeiro", uf: "RJ", lat: -22.9068, lng: -43.1729 },
  { nome: "Belo Horizonte", uf: "MG", lat: -19.9167, lng: -43.9345 },
  { nome: "Salvador", uf: "BA", lat: -12.9777, lng: -38.5016 },
  { nome: "Fortaleza", uf: "CE", lat: -3.7319, lng: -38.5267 },
  { nome: "Recife", uf: "PE", lat: -8.0476, lng: -34.8770 },
  { nome: "Curitiba", uf: "PR", lat: -25.4284, lng: -49.2733 },
  { nome: "Porto Alegre", uf: "RS", lat: -30.0346, lng: -51.2177 },
  { nome: "Manaus", uf: "AM", lat: -3.1190, lng: -60.0217 },
  { nome: "Belém", uf: "PA", lat: -1.4558, lng: -48.5044 },
  { nome: "Vitória", uf: "ES", lat: -20.3155, lng: -40.3128 },
  { nome: "Florianópolis", uf: "SC", lat: -27.5954, lng: -48.5480 },
  { nome: "Campo Grande", uf: "MS", lat: -20.4697, lng: -54.6201 },
  { nome: "Cuiabá", uf: "MT", lat: -15.6014, lng: -56.0979 },
  { nome: "João Pessoa", uf: "PB", lat: -7.1195, lng: -34.8450 },
  { nome: "Natal", uf: "RN", lat: -5.7945, lng: -35.2110 },
  { nome: "Maceió", uf: "AL", lat: -9.6498, lng: -35.7089 },
  { nome: "Aracaju", uf: "SE", lat: -10.9472, lng: -37.0731 },
  { nome: "Teresina", uf: "PI", lat: -5.0892, lng: -42.8019 },
  { nome: "São Luís", uf: "MA", lat: -2.5297, lng: -44.3028 },
  { nome: "Palmas", uf: "TO", lat: -10.1689, lng: -48.3317 },
  { nome: "Macapá", uf: "AP", lat: 0.0349, lng: -51.0694 },
  { nome: "Boa Vista", uf: "RR", lat: 2.8235, lng: -60.6758 },
  { nome: "Porto Velho", uf: "RO", lat: -8.7619, lng: -63.9039 },
  { nome: "Rio Branco", uf: "AC", lat: -9.9754, lng: -67.8249 },
]
