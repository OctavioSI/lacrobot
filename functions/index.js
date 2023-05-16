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

async function createTweet() {
    // Primeiro vamos pegar todos os conceitos disponíveis para o nosso bot no Firebase
    let conceitos = "";
    let newprompt = "";
    await db.collection('lacrobot').doc('twitter').get().then((snapShot) => {
        if (snapShot.exists && snapShot.data().conceitos && snapShot.data().conceitos.length > 0) {
            for (let i = 0; i < snapShot.data().conceitos.length; i++) {
                conceitos += "(" + (i + 1) + ") " + snapShot.data().conceitos[i] + "\n";
            }
        }
        if (snapShot.exists && snapShot.data().last_tweet) {
            newprompt += "Note que a sua última postagem foi a seguinte: \"" + snapShot.data().last_tweet + "\"";
        }
    });


    newprompt += "Escolha uma opção entre os conceitos fornecidos de forma aleatória, sendo diferente do conceito da sua última postagem, se houver, já que não queremos postagens repetitivas. Crie 1 tweet com base no conceito escolhido, e devolva a sua resposta sem colocá-la entre aspas, trazendo apenas o texto e sem trazer a numeração do conceito escolhido. ";

    function letsroll(min, max) {
        return Math.floor(
            Math.random() * (max - min) + min
        )
    }
    let chance = letsroll(0, 9);
    if (chance < 8) { // criar uma fic
        newprompt += "Lembre-se que em seu tweet você deve inventar um fato que ocorreu com você no trabalho durante esta semana. Fale algo que aconteceu durante a semana passada, não exatamente hoje.";
    } else if (chance < 9) { // postar um questionamento para outros devs
        newprompt += "Neste tweet, faça um questionamento para outros outros devs para que possam refletir sobre o assunto.";
    } else { // fazer um post motivacional
        newprompt += "Crie este tweet com um tom motivacional, para inspirar as pessoas que pensam como você.";
    }
    newprompt += " Lembre-se que o tweet completo deve sempre ter no máximo 280 caracteres, não podendo ultrapassar esse limite. Poste apenas o Tweet, sem colocar palavras antes ou depois. Por exemplo, não use algo como \"Tweet:\" ou \"Este é o tweet:\". "

    let data = {
        "model": "gpt-3.5-turbo",
        "messages": [{
                "role": "system",
                "content": "Você fará o papel de um usuário do Twitter que posta constantemente conteúdo para o público de desenvolvedores de software no Brasil. Seus tweets tem alto potencial de engajamento, podem contar histórias inventadas de algo que ocorreu com você durante o trabalho, devem ter um teor de provocação para incitar a discussão e devem utilizar um dos conceitos da lista que será apresentada a seguir escolhido aleatoriamente. Você pode também criar novos conceitos para basear o seu tweet, mas estes novos conceitos devem seguir a mesma linha de pensamento e viés ideológico que os conceitos a seguir. Quando se referir a programadores ou desenvolvedores de software, pode chamá-los de \"devs\". Ao final de cada tweet você deve colocar a hashtag #bolhadev e poderá marcar o @sseraphini às vezes, sendo que o tweet completo com essas marcações deve respeitar o limite de 280 caracteres.\n\nConceitos que devem ser considerados são os seguintes:\n\n" + conceitos
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
        console.log('newtweet', newtweet);
        if (newtweet.length > 280) {
            // GPT errou e colocou um texto maior que 280. Vamos pedir para gerar novamente
            data = {
                "model": "gpt-3.5-turbo",
                "messages": [{
                        "role": "system",
                        "content": "Você fará o papel de um usuário do Twitter que posta constantemente conteúdo para o público de desenvolvedores de software no Brasil. Seus tweets tem alto potencial de engajamento, podem contar histórias inventadas de algo que ocorreu com você durante o trabalho, devem ter um teor de provocação para incitar a discussão e devem utilizar um dos conceitos da lista que será apresentada a seguir escolhido aleatoriamente. Você pode também criar novos conceitos para basear o seu tweet, mas estes novos conceitos devem seguir a mesma linha de pensamento e viés ideológico que os conceitos a seguir. Quando se referir a programadores ou desenvolvedores de software, pode chamá-los de \"devs\". Ao final de cada tweet você deve colocar a hashtag #bolhadev e poderá marcar o @sseraphini às vezes, sendo que o tweet completo com essas marcações deve respeitar o limite de 280 caracteres.\n\nConceitos que devem ser considerados são os seguintes:\n\n" + conceitos
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
                        "content": "Não, o tweet que você escreveu tem mais de 280 caracteres. Refaça a solicitação, observando o limite de 280 caracteres."
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
                console.log('newtweet2', newtweet);
            }
        }
        await db.collection('lacrobot').doc('twitter').update({
            'last_tweet': newtweet
        });
    }
    return newtweet;
}

async function postTweet() {
    let tweet = await createTweet();
    rwClient.v2.tweet(tweet).then((val) => {
        console.log(val)
        console.log("success")
    }).catch((err) => {
        console.log(err)
    })
    return tweet;
}

const frequency = "13 13,15,19,21 * * *"; // “At minute 13 past hour 10, 12 and 16.”
exports.sendMyTweet = onSchedule(frequency, async(event) => {
    const tweet = await postTweet();
});

exports.sendMyTweetNow = onRequest((req, res) => {
    return cors(req, res, async() => {
        const tweet = await postTweet();
        res.status(200).send(tweet);
    });
});