# Nosso Novo Capítulo — Lista de Casa Nova

Projeto completo para uma página de casa nova com lista interativa de presentes.

A página pública permite que os convidados escolham um item. A área dos donos mostra quem escolheu o quê, WhatsApp, mensagem, status de recebido e opção de exportar CSV.

## Estrutura

```text
casa-nova-novo-capitulo/
├── index.html              # Página pública para convidados
├── admin.html              # Área dos donos
├── css/
│   └── styles.css          # Visual completo
├── js/
│   ├── config.js           # Configurações, Firebase e lista inicial
│   ├── public.js           # Funcionamento da página pública
│   └── admin.js            # Funcionamento do painel dos donos
├── firestore.rules         # Regras de segurança do Firestore
└── README.md               # Este passo a passo
```

## Como funciona o controle

O controle usa duas coleções no Cloud Firestore:

```text
items/
  jogo-copos
    title: "Jogo de copos"
    category: "cozinha"
    description: "Sugestão: 6 unidades."
    icon: "🥛"
    order: 1
    status: "available" ou "reserved"
    reservedAt: data/hora da reserva

reservations/
  jogo-copos
    itemId: "jogo-copos"
    itemName: "Jogo de copos"
    category: "cozinha"
    name: "Nome de quem escolheu"
    phone: "WhatsApp opcional"
    message: "Mensagem opcional"
    received: false ou true
    createdAt: data/hora da escolha
```

Quando um convidado escolhe um item, o sistema faz uma transação:

1. Lê o item em `items`.
2. Confirma que ele ainda está `available`.
3. Muda o item para `reserved`.
4. Cria o registro em `reservations` com o nome da pessoa.

Isso evita que duas pessoas reservem o mesmo presente ao mesmo tempo.

## Passo 1 — Criar o Firebase

1. Acesse o Firebase Console.
2. Crie um projeto.
3. Dentro do projeto, clique em **Add app** / **Adicionar app**.
4. Escolha **Web**.
5. Copie o objeto `firebaseConfig` gerado.

## Passo 2 — Ativar Firestore

1. No Firebase, vá em **Build > Firestore Database**.
2. Clique em **Create database**.
3. Escolha o modo de produção.
4. Escolha a região mais adequada.

## Passo 3 — Ativar login dos donos

1. No Firebase, vá em **Build > Authentication**.
2. Clique em **Get started**.
3. Ative o provedor **Email/Password**.
4. Crie um usuário com o e-mail dos donos.

Esse e-mail será usado para entrar no `admin.html`.

## Passo 4 — Configurar o projeto

Abra o arquivo:

```text
js/config.js
```

Troque:

```js
ownerEmails: ["seu-email@gmail.com"],
```

pelo e-mail que você criou no Firebase Authentication.

Depois cole o `firebaseConfig` real neste bloco:

```js
export const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI.firebaseapp.com",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI.appspot.com",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI",
};
```

## Passo 5 — Publicar regras de segurança

Abra o arquivo:

```text
firestore.rules
```

Troque:

```js
request.auth.token.email in ["seu-email@gmail.com"];
```

pelo mesmo e-mail dos donos.

Depois, no Firebase:

1. Vá em **Firestore Database > Rules**.
2. Apague as regras atuais.
3. Cole o conteúdo do arquivo `firestore.rules`.
4. Clique em **Publish**.

## Passo 6 — Rodar no VS Code

1. Abra a pasta `casa-nova-novo-capitulo` no VS Code.
2. Instale a extensão **Live Server**.
3. Clique com o botão direito em `index.html`.
4. Clique em **Open with Live Server**.

Não use duplo clique direto no arquivo, porque o projeto usa JavaScript em módulo.

## Passo 7 — Carregar a lista inicial

1. Abra `admin.html` pelo Live Server.
2. Entre com e-mail e senha cadastrados no Firebase Authentication.
3. Clique em **Carregar lista inicial**.
4. Volte para `index.html` e confira os itens.

## Passo 8 — Publicar para convidados

Opção mais simples:

1. Acesse Netlify Drop.
2. Arraste a pasta `casa-nova-novo-capitulo`.
3. Copie o link público gerado.
4. Envie aos convidados.

## Como personalizar os presentes

Abra `js/config.js` e edite o array `INITIAL_ITEMS`.

Cada item tem este formato:

```js
{
  id: "jogo-copos",
  title: "Jogo de copos",
  category: "cozinha",
  description: "Sugestão: 6 unidades.",
  icon: "🥛",
  order: 1,
}
```

Regras importantes:

- `id` não pode ter espaço nem acento.
- `category` precisa existir em `CATEGORIES`.
- `order` define a ordem de exibição.
- `icon` pode ser qualquer emoji.

## Como os donos acompanham

Acesse:

```text
https://seu-site.netlify.app/admin.html
```

Na área dos donos você consegue:

- ver quem escolheu cada item;
- ver WhatsApp e mensagem;
- marcar item como recebido;
- liberar item, caso alguém desista;
- exportar CSV para abrir no Excel/Google Sheets.

## Observações importantes

- O `firebaseConfig` pode ficar no código do front-end. Quem protege os dados são as regras do Firestore.
- Os convidados conseguem ler a lista pública, mas não conseguem ler os nomes e telefones salvos em `reservations`.
- Somente os e-mails liberados nas regras conseguem acessar a lista completa no painel dos donos.
- Se você mudar a lista em `config.js` depois de já ter carregado a lista inicial, entre no painel admin e clique novamente em **Carregar lista inicial**. Itens existentes serão atualizados, mas o status reservado será preservado.
