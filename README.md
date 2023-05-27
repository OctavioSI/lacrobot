
# LACROBOT

Um simples experimento dev.

O lacrobot foi uma brincadeira/experimento que conduzi no Twitter. O nome "lacrobot" foi pra chamar a atenção mesmo, e os conceitos que eu passei tem um viés mais "de esquerda" (até o nome do bot, **Carlos Marcos**, foi um trocadilho com "Karl Marx" 😂).

A ideia era criar um bot que fizesse postagens com base em alguns conceitos genéricos alimentados ao prompt do GPT, criando o conteúdo buscando engajamento como se fosse um usuário real.

A postagem (thread) completa do Twitter com o passo a passo de como foi feito está aqui:

https://twitter.com/octavioietsugu/status/1661719832352505857


O bot apenas usa esses conceitos genéricos para postar, então vc pode alimentá-lo com os conceitos que quiser (bem estereótipo mesmo) pra criar o seu **"bozobot"** ou o seu **"isentãobot"** se preferir. 

--------

Para utilizar este repo você deverá ainda criar as correspondentes chaves de acesso no Firebase gerando o arquivo JSON (service-account.json no repo) e criar a base de dados no Firestore.

Ainda, deve criar o arquivo .env com base no .env.example fornecido, que tem as chaves necessárias: do OpenAI e do Twitter.

Para mais detalhes, veja a thread em que detalhei o processo.


## Autor

- [@OctavioSI](https://www.github.com/OctavioSI)

Siga meu perfil no Twitter também: https://twitter.com/octavioietsugu


## Demo

Quer ver a demo? Visite o perfil do bot (o Carlos Marcos) aqui: https://twitter.com/_cmarcs

## Deploy

Como mencionado no Tweet esse projeto se baseia no firebase. Para dar o deploy, portanto, configure um projeto com o firebase init e depois faça o firebase deploy. Mais detalhes no link da thread fornecido acima

```bash
  firebase init

  firebase deploy
```


## Licença

[WTFPL](https://choosealicense.com/licenses/wtfpl/)
