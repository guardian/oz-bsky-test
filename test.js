const { BskyAgent, AppBskyFeedPost } = require("@atproto/api");
//const sharp = require("sharp");
const cheerio = require("cheerio");
const Parser = require("rss-parser");
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', {keepArray: true}],
    ]
  }
})
const dotenv = require('dotenv');
dotenv.config()

let accounty = process.env.ACC
let passy = process.env.PASS

aus_feeds = [
'https://www.theguardian.com/tracking/commissioningdesk/australia-state-news/rss',
'https://www.theguardian.com/collection/26378188-9e67-41fc-a44e-93b0bffbfacf/rss',
'https://www.theguardian.com/collection/79d9ddf6-a3f7-4d05-9fb4-bcf7c90ffdc0/rss',
'https://www.theguardian.com/collection/1179cc92-7831-42c5-8046-0f1ccea831a8/rss',
'https://www.theguardian.com/collection/7f0d9448-a9af-40a4-a567-24582060d46a/rss',
'https://www.theguardian.com/collection/au-alpha/features/feature-stories/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-business/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-culture/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-lifestyle/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-opinion/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-politics/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-sport/rss',
'https://www.theguardian.com/collection/7f0d9448-a9af-40a4-a567-24582060d46a/rss',
'https://www.theguardian.com/collection/5d60fb3d-9bb2-439b-81d4-3bd4d625165a/rss'
]

global_feeds = [
'https://www.theguardian.com/collection/a63f-82a9-8f63-edf1/rss'
]

// ### Function to post new posts 
async function post(agent, item) {

  console.log(`Post: ${item.title}`)

  const dom = await fetch(item.link)
    .then((response) => response.text())
    .then((html) => cheerio.load(html));

  let image_url = null;
  const image_url_ = dom('head > meta[property="og:image"]');
  if (image_url_) {
    image_url = await image_url_.attr("content");
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
      description: item.description,
      thumb: image.data.blob,
    },
    $type: "app.bsky.embed.external",
  };

  const res = AppBskyFeedPost.validateRecord(post);
  if (res.success) {
    agent.post(post);
  } else {
    console.log(res.error);
  }
}


// ### This is the actual funciton doing everything 

async function app(feeds){
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
    limit: 100,
    cursor: cursor,
  })

  for (const feed of recent.data.feed) {

    already_posted.push(feed.post.record.embed.external.uri)

  }

  const listicle = recent.data.feed.map(d => d.post.indexedAt)

  const latest = new Date(Math.max.apply(null, listicle.map((e) => new Date(e))))

  const diffInMs = new Date().getTime() - latest.getTime();
    
  if ( diffInMs > 300000) { // The last post was more than five minutes ago

    // Only post world stories between 1am and 6am, min of 5 minutes between posts all the time

    const rss = await Promise.all(feeds.map(url => parser.parseURL(url)))

    for await (const feed of rss) {

      for (const item of feed.items) {

        const age = new Date().getTime() - new Date(item.date).getTime();

        if (age <  28800000) { // Less than eight hours ago

          if (!already_posted.includes(item.link + '?CMP=aus_bsky')) {

            list_of_stories.push({
              title: item.title,
              link: item.link,
              description: item.contentSnippet,
              published : new Date(item.date).getTime()
            })

          }

        }

      }

    }

    if (list_of_stories.length > 0) {

      console.log(`Number of stories: ${list_of_stories.length}`)

      let posting = ""

      try {

        let ordered = list_of_stories.sort((a, b) => a.published - b.published);

        await post(agent, ordered[0]);

        posting = `Posted: ${ordered[0].title}`

      } catch(error) {

        console.log(error)

        posting = `Something went wrong`

      } finally {

        return posting

      }

    } else {

        return "No stories to post"

    }

  } else {

    return "The last post was less than five minutes ago"

  }

}


const temporal = (timestamp) => {
  
  var str = timestamp.toString()

  return str.split(",")[0]

}

async function wrapper() {

  let sydneyTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Australia/Sydney"})).getTime()

  let today = temporal(new Date().toLocaleString("en-US", {timeZone: "Australia/Sydney"}))

  let start = new Date(new Date(`${today} 1:00:00 AM`).toLocaleString("en-US", {timeZone: "Australia/Sydney"})).getTime()

  let end = new Date(new Date(`${today} 6:00:00 AM`).toLocaleString("en-US", {timeZone: "Australia/Sydney"})).getTime()

  let response = ""

  if (sydneyTime > start && sydneyTime < end) {

    response = "It is between 1am and 6am in Australia right now. International feeds. "

    response += await app(global_feeds) 

  } else {

    response = "Australian feeds. "

    response += await app(aus_feeds) 

  }

  return response

}

;(async function () {

  const response = await wrapper()

  console.log(response)


})();
