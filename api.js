const dotenv = require('dotenv');
dotenv.config()
const emailer = require("./mods/emailer");
//const Guardian = require('guardian-js');
const { BskyAgent, AppBskyFeedPost } = require("@atproto/api");
const cheerio = require("cheerio");


let accounty = process.env.ACC
let passy = process.env.PASS
let lastPost = 1200000
const numberOfPosts = 1 // Number of posts at one time


//const guardian = new Guardian.default(process.env.API, false);
// let edition = await guardian.content.search('au');

const post = async(agent, item) => {

  const dom = await fetch(item.link)
    .then((response) => response.text())
    .then((html) => cheerio.load(html));

  let image_url = null;
  const image_url_ = dom('head > meta[property="og:image"]');
  if (image_url_) {
    image_url = await image_url_.attr("content");
  }

  let description = ""
  let description_ = dom('head > meta[property="og:description"]');
  if (description_) {
  	description = await description_.attr("content");
  }

  const buffer = await fetch(image_url)
    .then((response) => response.arrayBuffer())

  const image = await agent.uploadBlob(buffer, { encoding: "image/jpeg" });

  let post = {
    $type: "app.bsky.feed.post",
    text: item.title,
    createdAt: new Date().toISOString()
  };

  post["embed"] = {
    external: {
      uri: `${item.link}?CMP=aus_bsky`,
      title: item.title,
      description: description,
      thumb: image.data.blob,
    },
    $type: "app.bsky.embed.external",
  };

  const res = AppBskyFeedPost.validateRecord(post);

  if (res.success) {
    await agent.post(post);
    return 'Posting succeeded!';
  } else {
    return 'Post failed!';
  }

}

async function app(feed1, feed2=[]){
  let list_of_stories = []
  let already_posted = []
  let cursor = "";

  // ### Login and validate  
  const agent = new BskyAgent({ service: "https://bsky.social" });

  await agent.login({
    identifier: accounty,
    password: passy,
  });

  // ### Grab the already posted stories 

  let recent = await agent.getAuthorFeed({
    actor: accounty,
    limit: 50,
    cursor: cursor,
  })

  for (const feed of recent.data.feed) {

    already_posted.push(feed.post.record.embed.external.uri)

  }

  const listicle = recent.data.feed.map(d => d.post.indexedAt)

  const latest = new Date(Math.max.apply(null, listicle.map((e) => new Date(e))))

  const diffInMs = new Date().getTime() - latest.getTime();
    
  if ( diffInMs > lastPost) { // lastPost The last post was more than five minutes ago

    // Only post world stories between 1am and 6am, min of 5 minutes between posts all the time

    const getStories = async (feed) => {

        for await (const item of feed) {

          const age = new Date().getTime() - new Date(item.webPublicationDate).getTime();

          if (age <  28800000) { // Less than eight hours ago

            if (!already_posted.includes(item.webUrl + '?CMP=aus_bsky') && !containsMatch(["ntwnfb", "nfbntw"], item.webUrl)) {

              list_of_stories.push({
                title: item.webTitle,
                link: item.webUrl,
                published : new Date(item.webPublicationDate).getTime()
              })

            }

          }

        }

    }

    await getStories(feed1)

    if (list_of_stories.length == 0 && feed2.length > 0) {

      await getStories(feed2)

    }

    if (list_of_stories.length > 0) {

      let posting = `<p>Number of stories: ${list_of_stories.length }</p>`      

      let ordered = list_of_stories.sort((a, b) => a.published - b.published);

      for (var i = 0; i < ordered.length; i++) {

        let message = await post(agent, ordered[i]);

        posting += `<p>Posted: ${ordered[i].title}</p>`

        if (i >= (numberOfPosts - 1)) {

          break

        }

      }

      return posting

    } else {

        return "<p>No stories to post</p>"

    }

  } else {

    return `<p>The last post was less than ${millisecondsToMinutes(lastPost)} minutes ago</p>`

  }

}
async function wrapper() {

  let sydneyTime = new Date()

  let today = temporal(new Date().toLocaleString("en-US"))

  let start = new Date(new Date(`${today} 0:00:00 AM`).toLocaleString("en-US")).getTime()

  let end = new Date(new Date(`${today} 6:00:00 AM`).toLocaleString("en-US")).getTime()

  let response = ""

  if (sydneyTime.getTime() > start && sydneyTime.getTime() < end) {

    lastPost = 2400000 // 40 minutes

    response = `<p>It is between 1am and 6am in Australia right now. ${sydneyTime}. International feeds.</p>`

    let global_feeds = await getArticles('australia-news')

    response += await app(global_feeds, []) 

  } else {

    lastPost = 1200000 // 20 minutes

    let aus_feeds = await getArticles('australia-news')

    let global_feeds = await getArticles('world')

    response = "<p>Australian feeds.</p> "

    response += await app(aus_feeds, global_feeds) 

  }

  return response

}

function millisecondsToMinutes(milliseconds) {
  const minutes = milliseconds / (1000 * 60);
  return minutes;
}


function containsMatch(arr, searchString) {
  for (let item of arr) {
    if (item.includes(searchString)) {
      return true;
    }
  }
  return false;
}

const temporal = (timestamp) => {
  
  var str = timestamp.toString()

  return str.split(",")[0]

}

async function getArticles(section='australia-news') {

	const baseUrl = `https://content.guardianapis.com/${section}`;

	const params = new URLSearchParams();
	params.append('api-key', process.env.API);

	const url = `${baseUrl}?${params.toString()}`;

	let json = await fetch(url).then(d => d.json())

	return json.response.results

}


;(async () => {


	const response = await wrapper()

	if (process.env.TESTING == "TRUE") {

	  let temp = await emailer('Bluesky@' + new Date() + " - from API", `${response}`, 'work@andyball.info')

	}

	console.log(response)


})();