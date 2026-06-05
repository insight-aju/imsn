# imsn-web — Guia do usuário

O imsn-web é o cliente Web/PWA do imsn Messenger.

Ele funciona sem servidor próprio nesta fase, usando o broker MQTT, assim como os ESPs standalone.

## Como instalar

### Android / Chrome

1. Abra o link oficial do imsn-web.
2. Toque em **Instalar imsn** quando aparecer.
3. Ou use o menu do Chrome e escolha **Adicionar à tela inicial** / **Instalar app**.
4. Abra pelo ícone do imsn.

### Windows / Chrome ou Edge

1. Abra o link oficial.
2. Clique no botão de instalar do navegador, quando aparecer.
3. Ou vá em **Config** e clique em **Instalar app**.

## Primeiro uso

1. Ao abrir pela primeira vez, informe seu **ID / alias**, **nome exibido** e **senha local**.
2. Clique em **Entrar no imsn**.
3. O app usará conexão segura automaticamente quando estiver no GitHub Pages.
4. Vá em **Contatos** e procure outro usuário pelo ID.

## Recursos ocultos

- `Hz` ativa áudio curto.
- `Px` ativa imagem.
- `Doc` ativa arquivos pequenos.
- `Bck` ativa backup local.

Exemplo: `igorHzPx` aparece para os outros como `igor`.

## Modo atual

Esta versão funciona em modo **Standalone / broker direto**.
Quando o servidor oficial existir, o app poderá passar para modo gerenciado.


## Segurança local

A senha local protege este PWA neste dispositivo. Nesta versão ela ainda não autentica no servidor, mas já prepara o caminho para a autenticação oficial futura.
