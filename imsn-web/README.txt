imsn-web v0.1.8.7.6.5.3

Correção de compatibilidade ESP: resolve user_id por presença/cache para convite, aceite e abertura de conversa.

Como testar:
1. Extraia a pasta.
2. Abra index.html no navegador.
3. Clique uma vez na página para liberar áudio/notificações.
4. Na aba Config, conecte ao MQTT.
5. Use o mesmo broker HiveMQ do ESP:
   - ESP: broker.hivemq.com:1883
   - Web: ws://broker.hivemq.com:8000/mqtt

Observações:
- Usa MQTT.js via CDN: https://unpkg.com/mqtt/dist/mqtt.min.js
- O navegador precisa de internet para carregar a biblioteca MQTT.js.
- Histórico, contatos e perfil ficam no localStorage deste navegador.
- Esta versão já conversa com ESPs usando os tópicos imsn/bootstrap/u/{user_id}.


v0.1.1: corrige abertura de conversa ao clicar na lista e abre automaticamente após convite aceito.


v0.1.2:
- Corrige conflito de nomes entre procurar contato e resolver contato local.
- Corrige abertura da conversa a partir da lista.
- Evita pedir permissão de notificação repetidamente; só mostra notificação se já estiver autorizada.

Correção v0.1.3: evita loop de som/travamento quando uma busca de contato já foi encontrada e chegam respostas repetidas.


v0.1.4:
- Compatibilidade reforçada com ESP: convites/respostas/mensagens/nudge publicam em tópico por user_id e, quando necessário, alias como fallback.
- Corrige aceite de convite Web -> ESP e envio Web -> ESP quando o contato foi resolvido por caminhos diferentes.


v0.1.6:
- Normaliza estilos de fonte recebidos/enviados.
- Chamar atenção toca sempre, mesmo com a conversa aberta.


Alteração v0.1.8:
- Menu do botão A agora mostra cada opção usando o próprio estilo de fonte correspondente.


v0.1.9: remove o cadeado duplicado ao lado do nome no cabeçalho da conversa. Mantém o botão de bloqueio e os cadeados das listas.


v0.1.10: corrige exibição de 'digitando...' recebido de ESPs, usando alias e user_id.


v0.1.11: corrige reabertura de conversas fechadas pelo X. Contatos salvos podem reabrir conversa ao clicar; mensagens e chamadas de atenção recebidas de contatos salvos reabrem a conversa automaticamente.


v0.1.12: corrige o botão X da janela de conversa. Agora ele limpa a conversa ativa imediatamente e volta para a lista de conversas, sem precisar minimizar antes.


v0.1.13: corrige fonte retrô, marca o estilo atual no menu A e adiciona lixeira para limpar histórico por conversa.


imsn-web v0.2.0 PWA

Esta versão adiciona:
- manifest.json completo
- service-worker.js
- cache offline da interface
- ícones 192/512
- apple-touch-icon
- aviso/botão de instalação quando o navegador permitir

Teste local:
1. Extraia a pasta.
2. Para PWA funcionar corretamente, rode por servidor local, não abrindo file:// diretamente.
   Exemplo no PC:
   python -m http.server 8080
   Depois abra:
   http://localhost:8080/

3. Em Android/Chrome, use o menu do navegador:
   "Adicionar à tela inicial" ou "Instalar app".

Observação:
- A interface abre em cache/offline depois do primeiro carregamento.
- Mensagens ainda precisam de internet e broker MQTT.
- Se abrir via file://, a página pode funcionar, mas service worker/PWA não funciona.


imsn-web v0.3.0 Avatar local

Adições:
- imagem de perfil local do usuário
- preview do avatar na aba Config
- avatar no cabeçalho principal
- avatar nas listas de contatos/conversas
- avatar no cabeçalho da conversa
- envio do avatar no payload de presença MQTT para outros clientes web
- fallback automático para inicial do nome quando não há imagem

Observações:
- A imagem fica salva no navegador/PWA em formato reduzido.
- ESPs continuam vendo a inicial, pois o firmware atual ignora avatar remoto.
- Futuramente o servidor poderá guardar/sincronizar a imagem real.


imsn-web v0.3.1 Avatar menu clean

Alterações:
- Remove o bloco grande de preview da imagem na aba Config.
- Mantém o input de arquivo oculto.
- Adiciona seta abaixo do avatar principal.
- Menu do avatar com:
  - Escolher imagem
  - Remover imagem
- Mantém as mesmas funções de avatar local, mas com interface mais limpa.


imsn-web v0.3.2 Avatar/PWA fix

Correções:
- Pacote ZIP agora vai com os arquivos do app na raiz do ZIP.
  Assim, ao extrair, rode o servidor dentro da pasta extraída onde está o index.html.
- A seta do avatar ficou com a mesma largura do avatar e não reduz mais a imagem.
- A seta abre o menu corretamente:
  Escolher imagem
  Remover imagem
- Adicionado botão "Instalar app" na aba Config.
- Se o PWA antigo abrir 404, remova/desinstale o app antigo e instale novamente a partir do endereço correto.

Uso correto:
1. Extraia o ZIP para uma pasta.
2. Entre na pasta onde está o index.html.
3. Rode:
   py -m http.server 8080
4. Abra:
   http://localhost:8080/


imsn-web v0.3.3
- Removido o botão abaixo da imagem.
- A própria imagem do perfil agora é clicável.
- O menu abre ao clicar na imagem, preservando o tamanho e o destaque do avatar.


imsn-web v0.4.0 IndexedDB base

Adições:
- db.js com banco local IndexedDB.
- Stores criadas:
  - meta
  - media
  - messages
- Estrutura preparada para:
  - áudio
  - imagem
  - arquivos
  - histórico mais parrudo
- Mensagens novas também são espelhadas no IndexedDB.
- Mantida compatibilidade com localStorage e lógica atual.
- MQTT, convites, bloqueio, fontes e avatar não foram alterados.

Observação:
- Esta versão prepara a fundação para mídia.
- Ainda não envia áudio/imagem; isso fica para as próximas versões.


imsn-web v0.5.0 Áudio experimental Hz

Adições:
- Mensagem de voz curta Web/PWA ↔ Web/PWA.
- Limite de gravação: 10 segundos.
- Botão 🎙️ só aparece quando o alias digitado termina com Hz.
  Exemplo:
  - campo alias: igorHz
  - alias público: igor
  - Áudio Broker: Ativo
- O sufixo Hz não é publicado para os outros usuários.
- Campo de mensagem vira visual de áudio durante/prévia.
- X vermelho descarta áudio gravado.
- Botão Enviar envia áudio gravado.
- Mensagem de áudio aparece na conversa com espectro, duração e botões ▶️ ⏸️ ⏹️.
- Áudios também são salvos na base local IndexedDB.

Observação:
- Recurso experimental para não saturar broker público.
- Se o receptor não suportar áudio, ele recebe um texto fallback.
- Futuramente, com servidor, o áudio poderá ser enviado como link/metadados.


imsn-web v0.5.1 Voice capability guard

Correções/segurança:
- O Web/PWA agora anuncia audio_broker:true/false na presença MQTT.
- Contatos Web/PWA que também ativaram Hz são marcados como compatíveis com áudio.
- Envio de áudio é bloqueado se o contato não anunciar suporte a audio_broker.
- Isso evita enviar áudio grande para ESPs ou clientes antigos.
- No cabeçalho da conversa, contatos compatíveis mostram “| áudio”.
- Futuro com servidor: contatos sem suporte poderão receber apenas link/metadados.


imsn-web v0.5.2 Voice feedback

Ajuste:
- O botão de microfone não fica mais bloqueado silenciosamente quando o contato não suporta áudio.
- Ao clicar no 🎙️ em uma conversa sem suporte, aparece no rodapé:
  "Áudio não suportado pelo contato."
- A trava de segurança continua impedindo o envio de áudio para ESPs/clientes antigos.


imsn-web v0.6.0 Imagem experimental Px

Adições:
- Envio de imagem Web/PWA ↔ Web/PWA.
- Easter egg Px:
  - campo alias: igorPx
  - alias público: igor
  - Imagem Broker: Ativo
- Combinações permitidas:
  - igorHz ativa áudio
  - igorPx ativa imagem
  - igorHzPx ou igorPxHz ativa áudio + imagem
- Botão 🖼️ aparece somente com Px ativo.
- O contato também precisa anunciar image_broker:true.
- Se o contato não suportar:
  "Imagem não suportada pelo contato."
- Imagem é reduzida para máximo 640 px no maior lado.
- Bloqueia envio se a imagem reduzida passar de cerca de 260 KB.
- Campo de texto vira prévia da imagem.
- X vermelho descarta a imagem.
- Botão Enviar envia a imagem.
- Mensagem aparece como miniatura clicável.
- Clique na miniatura abre a imagem maior.
- Imagens são salvas no IndexedDB.


imsn-web v0.7.0 Arquivos pequenos Doc

Adições:
- Envio de arquivos/documentos pequenos Web/PWA ↔ Web/PWA.
- Easter egg Doc:
  - campo alias: igorDoc
  - alias público: igor
  - Arquivo Broker: Ativo
- Combinações:
  - igorHz ativa áudio
  - igorPx ativa imagem
  - igorDoc ativa arquivos
  - igorHzPxDoc ativa áudio + imagem + arquivos
- Botão 📎 aparece somente com Doc ativo.
- O contato também precisa anunciar doc_broker:true.
- Se o contato não suportar:
  "Arquivo não suportado pelo contato."
- Limite inicial: 200 KB.
- Tipos permitidos:
  .txt, .pdf, .json, .csv, .log, .ino, .cpp, .h, .html, .css, .js, .md
- Campo de texto vira prévia do arquivo.
- X vermelho descarta o arquivo.
- Botão Enviar envia o arquivo.
- Mensagem aparece como card com nome, tamanho e botão Abrir.
- Arquivos são salvos no IndexedDB.


imsn-web v0.8.0 Backup local

Adições:
- Bloco "Backup local" na aba Config.
- Botão "Exportar backup".
- Botão "Importar backup".
- Backup em JSON contendo:
  - perfil
  - alias/configurações
  - contatos
  - conversas
  - mensagens
  - preferências
  - avatar
  - recursos Hz/Px/Doc
  - cópia das stores IndexedDB quando disponível
- Importação restaura o estado local e tenta reconectar MQTT.

Observação:
- Ao importar o backup em outro aparelho, ele restaura o mesmo user_id.
- Não use o mesmo backup simultaneamente em dois aparelhos conectados ao mesmo tempo, para evitar identidade duplicada.


imsn-web v0.8.1 Backup oculto Bck

Alteração:
- O bloco de Backup local agora fica oculto por padrão.
- Easter egg Bck libera a função:
  - campo alias: igorBck
  - alias público: igor
  - Backup local: Ativo
- Combinações:
  - igorHz ativa áudio
  - igorPx ativa imagem
  - igorDoc ativa arquivos
  - igorBck ativa backup
  - igorHzPxDocBck ativa todos
- O backup continua tecnicamente local, mas fica escondido até ser habilitado.
- No futuro, o servidor poderá supervisionar o uso de backup/restauração para evitar duplicidade de identidade.


imsn-web v0.9.0 Gerenciador de armazenamento local

Adições:
- Bloco "Armazenamento local" na aba Config.
- Mostra:
  - contatos
  - usuários conhecidos
  - mensagens no estado local
  - mensagens no IndexedDB
  - mídias no IndexedDB
  - tamanho aproximado do estado local
- Botão "Atualizar estatísticas".
- Botão "Limpar mídias locais".
- Botão "Limpar histórico local".
- Contatos e perfil são mantidos ao limpar histórico/mídia.


imsn-web v0.9.1 Armazenamento mais claro

Ajustes:
- Renomeia os rótulos técnicos do gerenciador de armazenamento.
- Explica a diferença entre:
  - contatos salvos
  - usuários descobertos recentemente
  - mensagens carregadas na interface
  - mensagens arquivadas no banco local
  - mídias/arquivos salvos
- Separa mídias por tipo:
  - áudios
  - imagens
  - arquivos/documentos
  - outros registros
- Esclarece que os tamanhos são aproximados e ficam em áreas diferentes do navegador.


imsn-web v0.9.2 Relatório de custo de armazenamento

Ajustes:
- O bloco de armazenamento agora mostra:
  - o que está salvo
  - quantidade
  - tamanho aproximado
  - onde pesa hoje
- Classificação:
  - Standalone: dados mínimos do cliente independente
  - Local: dados pesados/cache/mídia/histórico salvos no navegador/PWA
  - Servidor: uso atual do servidor, ainda 0 nesta fase
- Mostra resumo:
  - Standalone
  - Local neste navegador/PWA
  - Servidor
  - Total usado agora
- Itens como avatar, áudios, imagens e arquivos aparecem como Local agora / Servidor futuro.


imsn-web v0.9.3 Matriz de armazenamento

Correção conceitual:
- Um mesmo dado agora pode aparecer em mais de um local:
  - Standalone
  - Local/PWA
  - Servidor
- A tela mostra:
  - quantidade
  - tamanho ativo agora
  - tamanho por local
  - fonte usada agora
- Alias, nome, tema e preferências aparecem como redundantes entre Standalone e Local/PWA.
- Dados pesados aparecem como Local/PWA agora e Servidor futuro.
- O resumo final mostra:
  - Standalone reservado/duplicável
  - Local/PWA usado neste navegador
  - Servidor usado agora
  - Total físico atual aproximado
  - Total em uso pela fonte ativa


imsn-web v0.9.4 Relatório de armazenamento limpo

Ajustes visuais:
- Remove a linha "Fonte usada agora".
- Remove a linha "Tamanho ativo agora".
- Mantém o destaque visual no local ativo.
- Remove a explicação longa no final do resumo.
- Renomeia o botão "Limpar mensagens locais" para "Limpar mensagens".

Escopo do botão "Limpar mensagens":
- Limpa mensagens deste navegador/PWA.
- Limpa mensagens carregadas na interface.
- Limpa mensagens arquivadas no banco local.
- Mantém contatos, perfil, configurações, arquivos e mídias.
- Não apaga mensagens no ESP, em outros dispositivos ou no futuro servidor.


imsn-web v0.9.5 Quantidades limpas no relatório

Ajuste:
- Remove a linha "Quantidade" dos itens fixos, como alias, nome exibido, tema, fonte e preferências.
- Mantém "Quantidade" apenas nos itens que realmente variam:
  - Mensagens carregadas na interface
  - Mensagens arquivadas no banco local
  - Áudios salvos
  - Imagens salvas
  - Arquivos/documentos salvos


imsn-web v1.0.0-rc1 Consolidação standalone

Adições:
- Bloco "Sobre / Diagnóstico" na aba Config.
- Exibe:
  - versão do app
  - modo navegador/PWA
  - user_id
  - alias público
  - recursos ativos Hz/Px/Doc/Bck
  - status MQTT
  - suporte a IndexedDB
  - suporte a microfone
  - suporte a Service Worker/PWA
  - suporte a notificações
- Botão "Atualizar diagnóstico".
- Botão "Recarregar interface".
- Botão "Atualizar app/cache".

Objetivo:
- Fechar uma base Web/PWA standalone madura antes da fase imsn-server.


imsn-web v1.0.0-rc2 Config organizada

Ajustes:
- Recursos Hz/Px/Doc/Bck agora aparecem em uma linha compacta, sem lacunas.
- Campos Broker WebSocket, Path WebSocket e WSS/TLS foram movidos para "Conexão avançada".
- Botão "Diagnóstico" foi colocado na linha principal da Config.
- Bloco Sobre / Diagnóstico agora abre/recolhe.
- Bloco Armazenamento agora abre/recolhe a partir do Diagnóstico.
- Botão "Mostrar resumo" alterna para "Recolher resumo".
- A página Config fica mais limpa antes da fase do servidor.


imsn-web v1.0.0-client-standalone

Entrega:
- Cliente Web/PWA standalone pronto para distribuição por link.
- Corrige lacuna visual dos recursos ativos.
- Inclui estrutura server_policy para futuro servidor.
- Inclui server_guard nas mensagens futuras.
- Inclui diagnóstico de modo de operação.
- Não depende do imsn-server.
- Inclui README_USUARIO.md, README_TECNICO.md e PUBLICAR_GITHUB_PAGES.md.
