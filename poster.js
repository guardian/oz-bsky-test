const { BskyAgent, AppBskyFeedPost } = require("@atproto/api");

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

rss_feeds = ['https://www.theguardian.com/tracking/commissioningdesk/australia-politics/rss',
'https://www.theguardian.com/tracking/commissioningdesk/australia-business/rss'
]

// ### Function to post new posts 
async function post(agent, item) {
  let post = {
    $type: "app.bsky.feed.post",
    text: item.title,
    createdAt: new Date().toISOString(),
  };
  const dom = await fetch(item.link)
    .then((response) => response.text())
    .then((html) => cheerio.load(html));

  post["embed"] = {
    external: {
      uri: item.link,
      title: item.title,
      description: item.description,
    },
    $type: "app.bsky.embed.external",
  };

  const res = AppBskyFeedPost.validateRecord(post);
  if (res.success) {
    console.log(post);
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
          // console.log("items: ", item)
          // let inter_description = null;
          // const description_ = dom('head > meta[property="og:description"]');
          // if (description_) {
          //   inter_description = description_.attr("content");
          // }
          // ### Check to see if it has already been posted 
          if (!already_posted.includes(item.link + '?CMP=aus_bsky')){
          list_of_stories.push({
            title: item.title,
            link: item.link + '?CMP=aus_bsky',
            description: item.contentSnippet,
          image: item.media}
            )
          }
        }
        })
        ))
        
        .then(() => {


            // ### This is what's actually posting 
            list_of_stories.forEach(story => {
              post(agent, story);
            })

      

        })

        // .then(() => console.log("list_of_stories: ", list_of_stories))


}

do_everything(rss_feeds)



