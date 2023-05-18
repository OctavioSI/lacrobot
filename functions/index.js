const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const axios = require('axios');
const cors = require("cors")({ origin: true });
const { TwitterApi } = require('twitter-api-v2');
const client = new TwitterApi({
    appKey: `${process.env.TWITTER_CONSUMER_KEY}`,
    appSecret: `${process.env.TWITTER_CONSUMER_SECRET}`,
    accessToken: `${process.env.TWITTER_ACCESS_TOKEN}`,
    accessSecret: `${process.env.TWITTER_ACCESS_TOKEN_SECRET}`
});
const rwClient = client.readWrite;

const admin = require("firebase-admin");
const serviceAccount = require("./service-account.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FB_PROJECT}.firebaseio.com`
});
const db = admin.firestore();

/****
 * 
 * createTweet
 * 
 * Esta função cria o texto de um Tweet com base nos critérios pré-especificados.
 * Pode receber um parâmetro com instruções específicas que serão utilizadas na
 * criação do Tweet, não se baseando apenas nos conceitos pré-formulados.
 * 
 */

async function createTweet(customtweet = '') {
    let conceitos = "";
    let newprompt = "";
    let iscomplaint = false;
    // Primeiro vamos pegar todos os conceitos disponíveis para o nosso bot no Firebase
    // Temos um doc ali que pode ser alimentado com novos conceitos e que serão uma 
    // orientação do que o nosso bot deve seguir
    await db.collection('lacrobot').doc('twitter').get().then((snapShot) => {
        if (snapShot.exists && snapShot.data().conceitos && snapShot.data().conceitos.length > 0) {
            for (let i = 0; i < snapShot.data().conceitos.length; i++) {
                conceitos += "(" + (i + 1) + ") " + snapShot.data().conceitos[i] + "\n";
            }
        }
        // Abaixo analisamos qual o último Tweet feito também. Isso é necessário porque o 
        // GPT acaba repetindo muito os conceitos utilizados nas postagens.
        // Com esse ajuste garantimos que ele vai variar o assunto um pouco mais
        if (snapShot.exists && snapShot.data().last_tweet) {
            newprompt += "Note que a sua última postagem foi a seguinte: \"" + snapShot.data().last_tweet + "\"";
        }
    });

    // Primeiro vamos ver se há uma solicitação customizada de Tweet. Essa opção nos possibilita
    // criar um Tweet pontual sobre um assunto não especificado nos conceitos fornecidos antes.
    // Por exemplo, eu posso criar um tweet sobre um assunto que está mais em discussão no momento
    // sem que eu tenha que inserir esse conceito na base de dados.
    if (customtweet && customtweet !== '' && customtweet !== undefined && customtweet !== {}) {
        iscomplaint = false;
        newprompt += "Os conceitos fornecidos formam a sua opinião geral, personalidade e inclinação ideológica.  Com base nisso, crie 1 tweet com base no seguinte conceito ou solicitação, sem repetir o input mas criando algo novo: \"" + customtweet + "\". Devolva a sua resposta sem colocá-la entre aspas, trazendo apenas o texto";
        newprompt += " Lembre-se que o tweet completo deve sempre ter no máximo 280 caracteres, não podendo ultrapassar esse limite. Poste apenas o Tweet, sem colocar palavras antes ou depois. Por exemplo, não use algo como \"Tweet:\" ou \"Este é o tweet:\". "
    } else {
        // Funcao para gerar um resultado randomico
        function letsroll(min, max) {
            return Math.floor(
                Math.random() * (max - min) + min
            )
        }
        // Vamos dar uma mixada nos tweets para não parecer que o bot só reclama.
        let lacrar = letsroll(0, 9);
        if (lacrar < 3) {
            // Vamos falar algo normal, sem tom de reclamação.
            // Isso é necessário porque algumas pessoas estavam notando 
            // um comportamento muito artificial do perfil, que só reclamava.
            iscomplaint = false;
            newprompt += "Neste momento ignore os conceitos fornecidos, use-os apenas para formar a sua opinião geral, personalidade e inclinação ideológica. Crie 1 tweet inventando um fato aleatório, sem tom de crítica, de algo que aconteceu com você durante o trabalho na área de tecnologia. Pode ser algo positivo ou negativo, sempre sendo com algo relacionado a programação e tecnologia, mas com o intuito de divertir, ensinar ou fazer pensar quem lê a postagem. Devolva a sua resposta sem colocá-la entre aspas, trazendo apenas o texto e sem trazer a numeração do conceito escolhido. ";
        } else { // Vamos lacrar :)
            iscomplaint = true;
            newprompt += "Escolha uma opção entre os conceitos fornecidos de forma aleatória, sendo diferente do conceito da sua última postagem, se houver, já que não queremos postagens repetitivas. Crie 1 tweet com base no conceito escolhido, e devolva a sua resposta sem colocá-la entre aspas, trazendo apenas o texto e sem trazer a numeração do conceito escolhido. ";
            let chance = letsroll(0, 9);
            if (chance < 8) { // criar uma fic: queremos aumentar o numero de histórias possíveis.
                newprompt += "Lembre-se que em seu tweet você deve inventar um fato que ocorreu com você no trabalho durante esta semana. Fale algo que aconteceu durante a semana passada, não exatamente hoje.";
            } else if (chance < 9) { // postar um questionamento para outros devs
                newprompt += "Neste tweet, faça um questionamento para outros outros devs para que possam refletir sobre o assunto.";
            } else { // fazer um post motivacional
                newprompt += "Crie este tweet com um tom motivacional, para inspirar as pessoas que pensam como você.";
            }
            newprompt += " Lembre-se que o tweet completo deve sempre ter no máximo 280 caracteres, não podendo ultrapassar esse limite. Poste apenas o Tweet, sem colocar palavras antes ou depois. Por exemplo, não use algo como \"Tweet:\" ou \"Este é o tweet:\". "
        }
    }
    newprompt += " Não use em sua resposta nenhuma hashtag no tweet além da hashtag \"#bolhadev\" mencionada anteriormente. Por exemplo, não use #ganharbemnaotedaznodosmeiosdeproducao, #precariacaodotrabalho, #programacao ou qualquer outra hashag exceto pela \"#bolhadev\". E não coloque o texto final entre aspas";

    let data = {
        "model": "gpt-3.5-turbo",
        "messages": [{
                "role": "system",
                "content": "Você fará o papel de um usuário do Twitter chamado Carlos Marcos que posta constantemente conteúdo para o público de desenvolvedores de software no Brasil. Seus tweets tem alto potencial de engajamento, podem contar histórias inventadas de algo que ocorreu com você durante o trabalho, devem ter um teor de provocação para incitar a discussão e devem utilizar um dos conceitos da lista que será apresentada a seguir escolhido aleatoriamente. Você pode também criar novos conceitos para basear o seu tweet, mas estes novos conceitos devem seguir a mesma linha de pensamento e viés ideológico que os conceitos a seguir. Quando se referir a programadores ou desenvolvedores de software, pode chamá-los de \"devs\". Ao final de cada tweet você deve colocar a hashtag #bolhadev e poderá marcar o @sseraphini às vezes, sendo que o tweet completo com essas marcações deve respeitar o limite de 280 caracteres.\n\nConceitos que devem ser considerados são os seguintes:\n\n" + conceitos
            },
            {
                "role": "user",
                "content": newprompt
            }
        ],
        "temperature": 0.7
    };
    let config = {
        method: "post",
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_TOKEN}`

        },
        data: data
    };
    let newtweetrequest = await axios(config);
    let newtweet;
    if (newtweetrequest && newtweetrequest.data) {
        newtweet = newtweetrequest.data.choices[0].message.content;
        // console.log('newtweet', newtweet);
        if (newtweet.length > 280) {
            // GPT errou e colocou um texto maior que 280. Vamos pedir para gerar novamente
            // Apesar das instruções fornecidas, acontece de o GPT ignorar a regra de caracteres.
            // Isso causa a negativa da API do Twitter em postar o nosso tweet
            data = {
                "model": "gpt-3.5-turbo",
                "messages": [{
                        "role": "system",
                        "content": "Você fará o papel de um usuário do Twitter chamado Carlos Marcos que posta constantemente conteúdo para o público de desenvolvedores de software no Brasil. Seus tweets tem alto potencial de engajamento, podem contar histórias inventadas de algo que ocorreu com você durante o trabalho, devem ter um teor de provocação para incitar a discussão e devem utilizar um dos conceitos da lista que será apresentada a seguir escolhido aleatoriamente. Você pode também criar novos conceitos para basear o seu tweet, mas estes novos conceitos devem seguir a mesma linha de pensamento e viés ideológico que os conceitos a seguir. Quando se referir a programadores ou desenvolvedores de software, pode chamá-los de \"devs\". Ao final de cada tweet você deve colocar a hashtag #bolhadev e poderá marcar o @sseraphini às vezes, sendo que o tweet completo com essas marcações deve respeitar o limite de 280 caracteres.\n\nConceitos que devem ser considerados são os seguintes:\n\n" + conceitos
                    },
                    {
                        "role": "user",
                        "content": newprompt
                    },
                    {
                        "role": "assistant",
                        "content": newtweet
                    },
                    {
                        "role": "user",
                        "content": "Não, o tweet que você escreveu tem mais de 280 caracteres. Refaça a solicitação, observando o limite de 280 caracteres. Não escreva nada como \"Desculpe pelo erro\" ou algo parecido, e retorne apenas o texto do tweet reformulado, sem nenhum comentário antes ou depois, e não coloque o texto final entre aspas."
                    }
                ],
                "temperature": 0.7
            };
            config = {
                method: "post",
                url: "https://api.openai.com/v1/chat/completions",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.OPENAI_TOKEN}`

                },
                data: data
            };
            let newtweetrequest2 = await axios(config);
            if (newtweetrequest2 && newtweetrequest2.data) {
                newtweet = newtweetrequest2.data.choices[0].message.content;
            }
        }
        if (iscomplaint) {
            // Se foi uma reclamação, vamos salvar o tweet na DB
            await db.collection('lacrobot').doc('twitter').update({
                'last_tweet': newtweet
            });
        }
    }
    return newtweet;
}

/**
 * 
 * Aqui temos a função que efetivamente posta o tweet
 * por meio da API do Twitter
 * 
 */
async function postTweet(customtweet = '') {
    let tweet = await createTweet(customtweet);

    rwClient.v2.tweet(tweet).then((val) => {
        console.log(val)
        console.log("success")
    }).catch((err) => {
        console.log(err)
    })

    return tweet;
}

const frequency = "13 13,15,18,19,21 * * *"; // Vamos postar em alguns horários determinados (GMT-3).
exports.sendMyTweet = onSchedule(frequency, async(event) => {
    const tweet = await postTweet();
});

// Abaixo abrimos um endpoint para receber uma solicitação de 
// novo tweet fora dos horários agendados. Isso nos permite postar a 
// qualquer momento que quisermos.
exports.sendMyTweetNow = onRequest((req, res) => {
    return cors(req, res, async() => {
        // Passamos um código de verificação interno, apenas para ter alguma segurança de que o endpoint
        // não será utilizado de forma abusiva (já que não temos aqui um sistema de autenticação)
        if (!req.headers.verificationcode || req.headers.verificationcode !== process.env.VERIFICATIONCODE) {
            res.status(401).send("Unauthorized");
        } else {
            const tweet = await postTweet(req.body.question);
            res.status(200).send(tweet);
        }
    });
});