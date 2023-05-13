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

// const puppeteer = require('puppeteer');

async function createTweet() {
    // Primeiro vamos pegar todos os conceitos disponíveis para o nosso bot no Firebase
    let conceitos = "";
    await db.collection('lacrobot').doc('twitter').get().then((snapShot) => {
        if (snapShot.exists && snapShot.data().conceitos && snapShot.data().conceitos.length > 0) {
            for (let i = 0; i < snapShot.data().conceitos.length; i++) {
                conceitos += "(" + (i + 1) + ") " + snapShot.data().conceitos[i] + "\n";
            }
        }
    });
    let newprompt = "Crie 1 tweet escolhendo aleatoriamente apenas um dos conceitos fornecidos. Devolva a sua resposta sem colocá-la entre aspas, trazendo apenas o texto e sem trazer a numeração do conceito escolhido. ";

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

/*
async function readTweet(tweetId) {
    // Launch Puppeteer
    const browser = await puppeteer.launch({
        //        headless: true,
        //        args: ['--no-sandbox', '--incognito'],
        headless: false,
        args: ['--start-maximized', '--incognito'],
        defaultViewport: null
    });

    // Create a new page
    const page = await browser.newPage();

    // Navigate to the target URL
    let twitter_url = `https://twitter.com/_cmarcs/status/${tweetId}`;
    await page.goto(twitter_url);

    // Aguarda a pagina carregar o feed
    await page.waitForSelector('div[aria-label^="Timeline: "]');
    const tweetReplies = await page.evaluate(() => {
        const tweets = document.querySelectorAll('article[data-testid="tweet"]')
        const tweetsArray = Array.from(tweets);
        return tweetsArray.map(t => {
            const reply = t.querySelector('div[data-testid="tweetText"]')
            const authorDataText = authorData ? authorData.textContent : ""
            const authorComponents = authorDataText.split('@')
            const authorComponents2 = authorComponents[1].split('·')
            return {
                authorName: authorComponents[0],
                authorHandle: '@' + authorComponents2[0],
                date: authorComponents2[1],
            }
        })
        return tweetsArray;
    })

    // Close the browser
    // await browser.close()
    return tweetReplies;
}
*/

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

/*
exports.readMyTweetNow = onRequest((req, res) => {
    return cors(req, res, async() => {
        const tweet = await readTweet(req.query.tweetId);
        res.status(200).send(tweet);
    });
});
*/