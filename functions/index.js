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
    await db.collection('lacrobot').doc('twitter').get().then((snapShot) => {
        if (snapShot.exists && snapShot.data().conceitos && snapShot.data().conceitos.length > 0) {
            for (let i = 0; i < snapShot.data().conceitos.length; i++) {
                conceitos += "- " + snapShot.data().conceitos[i] + "\n";
            }
        }
    });
    let data = {
        "model": "gpt-3.5-turbo",
        "messages": [{
                "role": "system",
                "content": "Você fará o papel de um usuário do Twitter que posta constantemente conteúdo para o público de desenvolvedores de software no Brasil. Seus tweets tem alto potencial de engajamento, podem conter histórias inventadas de algo que ocorreu com você, devem ter um teor de provocação para incitar a discussão e devem utilizar pelo menos um dos conceitos a seguir escolhido aleatoriamente. Você pode também criar novos conceitos para basear o seu tweet, mas estes novos conceitos devem seguir a mesma linha de pensamento e viés ideológico que os conceitos a seguir expressam. Quando se referir a programadores ou desenvolvedores de software, pode chamá-los de \"devs\". Ao final de cada tweet você deve colocar a hashtag #bolhadev e poderá marcar o @sseraphini, sendo que o tweet completo com essas marcações deve respeitar o limite de 280 caracteres.\n\nConceitos que devem ser considerados são os seguintes:\n\n" + conceitos
            },
            {
                "role": "user",
                "content": "Crie 1 tweet sem colocá-lo entre aspas, trazendo apenas o texto."
            }
        ],
        "temperature": 0.7
    };
    console.log('data gpt: ', data);
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

const frequency = "15 10,12,16 * * *"; // “At minute 15 past hour 10, 12 and 16.”
exports.sendMyTweet = onSchedule(frequency, async(event) => {
    const tweet = await postTweet();
});

exports.sendMyTweetNow = onRequest((req, res) => {
    return cors(req, res, async() => {
        const tweet = await postTweet();
        res.status(200).send(tweet);
    });
});