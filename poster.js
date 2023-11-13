const { BskyAgent, AppBskyFeedPost } = require("@atproto/api");
const timer = ms => new Promise(res => setTimeout(res, ms)) 

const sharp = require("sharp");

// ### envrionment variables 
const dotenv = require('dotenv');
dotenv.config()
// console.log(process.env)
// import dotenv from 'dotenv'
// dotenv.config()

const cheerio = require("cheerio");

const Parser = require("rss-parser");
// const parser = new Parser();
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', {keepArray: true}],
    ]
  }
})

accounty = process.env.ACC
passy = process.env.PASS

// rss_feeds = ['https://www.theguardian.com/tracking/commissioningdesk/australia-politics/rss',
// 'https://www.theguardian.com/tracking/commissioningdesk/australia-business/rss',
// 'https://www.theguardian.com/collection/au-alpha/features/feature-stories/rss',
// ]

rss_feeds = ['https://www.theguardian.com/collection/7f0d9448-a9af-40a4-a567-24582060d46a/rss','https://www.theguardian.com/tracking/commissioningdesk/australia-politics/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-business/rss'
]

// ### Function to post new posts 
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
    .then((buffer) => sharp(buffer))
    .then((s) =>
      s.resize(
        s
          .resize(800, null, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({
            quality: 80,
            progressive: true,
          })
          .toBuffer()
      )
    );
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

async function do_everything(feeds){
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

  await agent.getAuthorFeed({
      actor: accounty,
      limit: 5,
      cursor: cursor,
    }).then(response => 
      {
        cursor = response.cursor

        let latest = response.data.feed.map(d => d.post.indexedAt)

        console.log(new Date(Math.max.apply(null, latest.map(function(e) {
          return new Date(e);
        }))))

        console.log(new Date())

        for (const feed of response.data.feed) {
          already_posted.push(feed.post.record.embed.external.uri)
        }
      }
    // ).then(() => console.log("already_posted: ", already_posted)
    )

  // ### This first grabs the stories 

    Promise.all(feeds.map(url => parser.parseURL(url)
      .then(response => 
        {
        for (const item of response.items)
        {
          // let inter_description = null;
          // const description_ = dom('head > meta[property="og:description"]');
          // if (description_) {
          //   inter_description = description_.attr("content");
          // }
          // ### Check to see if it has already been posted 
          if (!already_posted.includes(item.link + '?CMP=aus_bsky')){
            list_of_stories.push({
              title: item.title,
              link: item.link,
              description: item.contentSnippet
            })
          }
        }
        })
        ))
        
        .then(() => {

          console.log(list_of_stories.length)

          final(agent, list_of_stories)

        })

}

const final = async (agent, listicle) => {



  for await (const story of listicle) {
    post(agent, story);
    //await timer(2000)
    //console.log(story)
  }

}

do_everything(rss_feeds)



