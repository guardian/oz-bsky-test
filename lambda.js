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

let accounty = process.env.ACC
let passy = process.env.PASS

aus_feeds = [
'https://www.theguardian.com/tracking/commissioningdesk/australia-news/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-state-news/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-culture/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-lifestyle/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-opinion/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-politics/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-sport/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-features/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-investigations/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-data/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-video/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-pictures-/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-technology/rss',
'https://www.theguardian.com/tracking/commissioningdesk/new-zealand/rss',
'https://www.theguardian.com/tracking/commissioningdesk/pacific-news/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-business/rss',
'https://www.theguardian.com/tracking/commissioningdesk/the-rural-network/rss',
'https://www.theguardian.com/collection/5d60fb3d-9bb2-439b-81d4-3bd4d625165a/rss'
]

global_feeds = [
'https://www.theguardian.com/collection/cdad59a3-e992-40f1-bf8d-677398064116/rss',     
'https://www.theguardian.com/collection/A22fa7fc-684f-484a-90bf-3f5aa4b711f7/rss',     
'https://www.theguardian.com/collection/016d967f-0303-4a47-b5e0-bf6d36ad4a52/rss',     
'https://www.theguardian.com/collection/a63f-82a9-8f63-edf1/rss' 
]

async function post(agent, item) {

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

  let sydneyTime = new Date()

  let today = temporal(new Date().toLocaleString("en-US"))

  let start = new Date(new Date(`${today} 1:00:00 AM`).toLocaleString("en-US")).getTime()

  let end = new Date(new Date(`${today} 6:00:00 AM`).toLocaleString("en-US")).getTime()

  let response = ""

  if (sydneyTime > start && sydneyTime < end) {

    response = `It is between 1am and 6am in Australia right now. ${sydneyTime}. International feeds. `

    response += await app(global_feeds) 

  } else {

    response = "Australian feeds. "

    response += await app(aus_feeds) 

  }

  return response

}

exports.handler = async (event) => {
    
    const response = await wrapper()

    return response

};