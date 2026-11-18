// The people in the Shrug group chat. Names, roles and relationship tags are
// from the design canvas; each quote is that person's testimonial as published
// on shrug.vc.

import { typeset } from './typeset'

export type Relation = 'F' | 'L' | 'C'

export interface Person {
  name: string
  role: string
  /** F: backed by Shrug. L: backs Shrug. C: co-investor. */
  relations: Relation[]
  /** The testimonial. `null` shows placeholder lines instead. */
  quote: string | null
}

export const RELATION_LABEL: Record<Relation, string> = {
  F: 'Backed by Shrug',
  L: 'Backs Shrug',
  C: 'Co-investor',
}

const p = (name: string, role: string, tags: string, quote: string | null = null): Person => ({
  name,
  role,
  relations: tags.split('') as Relation[],
  quote: quote && typeset(quote),
})

export const PEOPLE: Person[] = [
  p('Kevin Olusola', '1/5 of Pentatonix', 'LC',
    'They’re the best. Point blank. Their access is unparalleled.'),

  p('Reed Duchscher', 'Co-Founder of Night & Feastables', 'FC',
    'Niv and Moshe haven\'t made any introductions that weren\'t worth 100% of my time. They\'ve been awesome to work with across both Night and Feastables.'),

  p('Trae Stephens', 'Founders Fund & Anduril', 'C',
    'Shrug has a unique perspective on early-stage ventures, they hustle like none other, and use their network to provide critical early leverage to their portfolio. They are at the top of my list for favorite funds to partner with at Founders Fund.'),

  p('Michael Kives', 'Co-Founder of K5 Global', 'LC',
    'Niv and Moshe have an incredible network, and a rare talent for bringing the right people together. We\'ve worked together for a number of years, and I\'ve seen first-hand how they create buzz and momentum around the companies they invest in, while regularly bringing unique opportunities our way.'),

  p('Ellen DaSilva', 'Founder of Summer Health', 'F',
    'It\'s been a privilege to work with Moshe and the team at Shrug. They have been extremely helpful rolling up their sleeves to guide us on improving our product experience, thinking through top-of-funnel marketing initiatives, and assessing our fundraising strategy. We feel grateful to have them in our corner.'),

  p('Maddie Hall', 'Co-Founder of Living Carbon', 'F',
    'The Shrug team connected us to many of our earliest investors, which is so critical for an early-stage ambitious deep tech company like Living Carbon. Niv and the team are kings and queens of messaging and communication. They are number one in my book for helping us share our product with others and with the world.'),

  p('Jonathon Triest', 'Founder of Ludlow Ventures', 'C',
    'Moshe and Niv are in a league of their own. I don\'t know of any other VCs who pour so much love and attention into every single company they invest in. Their network is bananas, absolutely bananas, and they plug founders into it on day one. They are wildly creative, super savvy, and perfectly nerdy. I\'m honored to call them close friends.'),

  p('Alex Pall', 'The Chainsmokers & Mantis', 'LC',
    'While Drew and Myself are relatively new to the Venture capital space we are fast learners and one skill we have never lacked is being able to identify qualities in people that make them exceptional. Niv and Moshe were two of the first venture firms kind enough to take the time to speak with us and since then we have become not only close friends but they offer us the most valued advice. Their ability to see around the corner and find deals at this stage is unparalleled. It has been an honor to work with them and learn and we have an expression here at Mantis, when Shrug is in, so are we!'),

  p('Cyan Banister', 'Long Journey Ventures', 'LC',
    'The team at Shrug is unparalleled when it comes to their ability to spot early trends and invest in them. Once part of their portfolio, they work tirelessly for you. A lot of people talk a good talk about being “value add”, but for Shrug it’s the real deal. Plus they are fun. Life is short and if you want a ride or die by your side, this is the fund for you.'),

  p('Steve Pagliuca', 'Co-Chair of Bain Capital and Co-Owner of the Boston Celtics', 'LC',
    'Niv and Moshe have created a fund that has great core values. They are nimble, creative, and put founders first. They have a unique style in building and growing great companies that differentiates them in the increasingly competitive VC market. I am thrilled to be an investor in Shrug and I look forward to their long-term success.'),

  p('Jim Breyer', 'Co-Founder of Breyer Capital', 'LC',
    'Niv and Moshe are excellent investors, partners, and people. It’s been an honor and pleasure to invest alongside them, and Breyer Capital couldn’t be prouder to back Shrug. We\'ve heard from numerous founders in their portfolio that Shrug is the MVP on their cap table, and after seeing first-hand the lengths they go to in helping their companies, such feedback isn’t at all surprising. Every entrepreneur backed by Shrug has an unfair advantage.'),

  p('B.J. Novak', 'Actor, Director, Author, Meme, Founder of Chain', 'LC',
    'Shrug always spots intriguing things that I love learning about, and I can definitely say they have the most fun merch in their class.'),

  p('Sarah Tavel', 'GP at Benchmark', 'C',
    'One of my favorite things about Niv and the Shrug team is that if they are investors, you get not just an uber connector (though they are that), but true presidents of your fan club. Niv leaves a trail of Superplastic boxes, Poparazzi pops, Atom shoes, and so much more wherever he goes. And of course, the ultimate success of a founder should be measured in whether they earn a tattoo on Niv’s skin one day. If you’re building a product, can’t imagine a better group in your corner at the seed than Shrug.'),

  p('Andrew Gazdecki', 'Founder of Acquire.com', 'F',
    'To put it simply Shrug Capital is one of the rare funds that truly goes out of their way to help founders. They’re one of the biggest value adds on my cap table by a mile.'),

  p('Scott Belsky', 'Chief Product Officer of Adobe', 'LC',
    'Niv and Moshe feel the pulse of tech and consumer behavior, and have built an incredible network and brand that founders love. As a frequent collaborator, I admire Shrug’s relationships with teams and unique view on the industry.'),

  p('Ashton Kutcher', 'Co-Founder of Sound Ventures', 'LC',
    'Niv has a couple of the key ingredients of a great investor. First his network is very strong. He builds deep relationships with differentiated founders. Next, I think he has a entrepreneurs mind. He sees the potential in platforms that others may just see as toys. He doesn\'t undervalue the magic.'),

  p('Delian Asparouhov', 'Co-Founder of Varda & Partner at Founders Fund', 'FC',
    'Moshe is one of my favorite people to work with and co-invest with! As both a founder and co-investor, I\'ve seen him hustle and add real value first hand, way beyond what one would expect. His network never fails to amaze me and when he recommends I chat/meet with someone I take his word for it. If you have the chance to get Shrug on your cap table I\'d highly recommend doing so :)'),

  p('Ashley Mayer', 'GP at Coalition Operators', 'LC',
    'Niv approaches the craft of startup investing with an abundance mindset. He’s generous with his time, wisdom and deal flow, and goes out of his way to encourage emerging investors. He’s the ultimate champion for his portfolio, and I’ve been lucky to invest alongside him a handful of times. In a field that often takes itself a little too seriously, Niv has built a venture capital brand that’s playful and celebratory, humorous but never cynical. Our ecosystem is better off with Niv and Shrug in it.'),

  p('David Grutman', 'Groot Hospitality', 'C',
    'I was introduced to Moshe by Mayor Suarez and since then we’ve become true friends. Moshe and Niv have gotten me into a bunch of inspiring companies since getting to know them. Their network is incredible, founders love them and most importantly they pull through with what they say they’re going to do!'),

  p('Kevin Hartz', 'Co-Founder of Eventbrite & A*', 'LC',
    'Niv and the whole Shrug team are the brightest and hardest working seed investors in tech. As a founder myself, I would want them in my corner. You should as well.'),

  p('Walid Halty', 'Founder of Mona Lee Solar', 'F',
    'We’re very lucky to have Moshe & Niv as investors/partners. Their diligence process was very transparent and efficient. Once they made the decision to invest in us, they became our champions and connected us to many top tier investors. Our round then quickly became oversubscribed. We really look forward to building with the Shrug team in our corner!'),

  p('Nicole Quinn', 'GP at Lightspeed Ventures', 'C',
    'For years now, Niv has been one of my favorite VCs to work with. Whether it be us telling Niv about the most interesting early stage startups (e.g. Cameo) or him telling us about companies changing the consumer landscape (e.g. NewNew), we love working with Niv. The shrug team is always at the cutting edge of consumer trends and focused on what could be defining popular culture tomorrow. It\'s not just at the fundraising stage but it\'s the years afterwards that Niv spends helping his companies that really sets him apart.'),

  p('Steven Vasilev', 'Co-Founder of RTFKT', 'F',
    'Niv and Moshe are legends! They helped us navigate our round and gave us 10/10 intros. We said if we ran a fund it would be like Shrug.'),

  p('Akash Nigam', 'Co-Founder of Genies', 'FC',
    'Niv and Moshe have the Midas touch. They’re always one step ahead of culture which is almost always impossible in today’s generation’s ever changing behaviors. To us, there’s no better indication on a deal than Shrug in it.'),

  p('Ryan Hoover', 'Weekend Fund & Product Hunt', 'C',
    'Niv and Moshe are super connectors, bridging the gap between leaders in tech and entertainment. They\'re also one of the most thoughtful marketers for their portfolio – in public and private – with a strong pulse on how to capture attention in a tasteful, culturally relevant way.'),

  p('Karen Gillan', 'Actress, daughter of Thanos', 'C',
    'Niv has been invaluable in helping me make the transition from actor to founder. I really didn’t know where to start in this completely new environment and he guided me, introduced me to incredible people and set me up for success. I’m so grateful to Niv and Shrug for giving me a whole new network. I can honestly say, I wouldn’t be where I am with my start-up today if it wasn’t for Niv investing his time and effort into me and my start-up ambitions.'),

  p('David Sacks', 'Founder of Craft Ventures & Bestie at All-In Pod', 'LC',
    'We were introduced to Niv by Naval Ravikant in late 2017 when he was transitioning out of AngelList to run his own fund. From the first meeting it was clear that Niv has a nose for emergent trends: Niv was raving about Superhuman and Atoms before they were cool. Since backing Niv, we\'ve had the opportunity to co-invest in a number of startups - and have led two deals Niv brought to us: Superplastic and The Custom Movement.'),

  p('Boris Wertz', 'Founder of Version One Ventures', 'LC',
    'Niv and the whole Shrug team are one of our favourite co-investors - they spot incredibly interesting opportunities early on and work hard for their portfolio companies. You simply want to have them on your team!'),

  p('Leore Avidar', 'Founder of Alt & Lob', 'FL',
    'Moshe and Niv are hustlers. They’re consistently proactive in finding new ways to add value and are thoughtful in how they partner with founders. They’ve collaborated with us on a super valuable marketing initiative to share our product via Shrug VIP and have introduced us to Athletes, Artists, and best in class operators to help us along our journey. You will not find more authentic, quality and smart humans than the people at Shrug!'),

  p('Tony Hawk', 'Skateboarder', 'LC',
    'I was introduced to Niv by my friend David Ulevitch who described him as a "mini-Sacca,” which is high praise from someone I trust. Niv has his finger on the pulse of the latest cultural trends, and regularly sends interesting co-investment opportunities that are equally intriguing.'),

  p('Magdalena Kala', 'GP at Double-Down & Pags Group', 'LC',
    'Niv and Moshe move at the speed of cultural & societal trends. This, combined with their extensive network and masterful growth marketing efforts, has resulted in superior deal flow and excellent early track record. They know precisely what they offer to the entrepreneurs (actionable connections & hands-on fundraising help) and what their competitive advantage in the market is, and they execute ruthlessly against it. I love working with them, whether debating diligence perspectives as a co-investor or discussing fund strategy as an LP. But smarts & hustle are not the only attributes of great partners – Niv and Moshe are fun, thoughtful, and caring people, which is why it\'s such a joy to work with them.'),

  p('Packy McCormick', 'Founder of Not Boring', 'C',
    'As I was getting Not Boring Capital off the ground, no one was more helpful than Niv. From our first call, he helped me think through how to size and raise the fund, and when I started raising, he introduced me to some of Shrug\'s LPs, many of whom are now Not Boring Capital LPs. Whenever I have a question, he\'s down to talk it out. Whenever there\'s a great deal, he shares it. And all this for someone who\'s ostensibly a competitor… I can\'t even imagine how helpful he is to Shrug\'s portfolio companies 🤯'),

  p('Lenny Rachitsky', 'Founder of LennysNewsletter.com', 'C',
    'Lots of investors talk about being "value-add", but rarely deliver. Niv and Moshe are the complete opposite. They go above and beyond, surprising you with your product on a billboard, hoping on a call any time of day to talk GTM or hiring strategy, following up every one of your investor update asks, and helping you raise a great next round. If you have a chance to work with these guys, don\'t pass it up.'),

  p('Siqi Chen', 'Founder of Runway', 'FC',
    'Niv is simply one of my favorite investors and is the first person I recommend. If there were a pound-for-pound ranking in early stage investing, Shrug has gotta be at the top of that list. Niv is insanely connected - I know firsthand that he is personally responsible for a large chunk of deal flow into top tier funds. Having Niv on your cap table is a no-brainer.'),

  p('Elizabeth Weil', 'Founder of Scribble Ventures', 'LC',
    'Scribble Ventures has been delighted to work with Moshe and Niv through the years. This team has been wonderful to co-invest with, deal swap, spar on company ideas and investments, and extend our network to help founders build awesome companies. I love the momentum they bring to the industry and the drive and push they have to make good decisions and hustle for companies.'),

  p('Veeraj Chugh', 'Co-Founder of Opal', 'F',
    'Every time I\'ve interacted with Niv, I\'ve been struck by how deeply he gets marketing and the intricacies of consumer behavior. He\'s not just about big shiny ideas; he truly understands the details of how to communicate to investors, customers and other humans. Shrug’s team is incredibly responsive and you leave every conversation with a confidence that these guys will be there for you, come what may. It’s incredibly refreshing to have trusted partners like them in the venture world.'),

  p('Sam Corcos', 'Co-Founder and CEO of Levels', 'F',
    'Moshe was the second person to receive the pitch for the company that ultimately became Levels. He\'s incredibly responsive and generous with his time, which is something on which we index heavily when looking for investors. Shrug has also been helpful in spreading the word and generating revenue for us at Levels.'),

  p('Ryan Delk', 'Co-Founder of Primer', 'F',
    'Niv has the x-factor that’s hard to find: he does the work.” I briefly asked him for feedback on a deck a few weeks ago and he sent back ~2,000 words of detailed feedback. He’s always willing to roll up his sleeves with the team.'),

  p('Matteo Franceschetti', 'Co-Founder of Eight Sleep', 'FC',
    'Niv and Moshe were instrumental in helping build the hype for what Eight Sleep is building by bringing in amazing investors both directly and through the SPV that they put together which included people from tech, media, entertainment, sports and more. If you have the chance to have them on your cap table – take it.'),

  p('Paul Budnitz', 'Founder of Superplastic', 'F',
    'Niv was the second person to invest, and he introduced me to at least half of the 30 or so investors that came into our seed round — including Bill Lee from Craft who led our Series A, Scooter Braun, Scott Belsky, Kevin Weil, and others I didn’t know personally.'),

  p('Roger Ehrenberg', 'Eberg Capital', 'LC',
    'Niv and Moshe are the consummate connectors. They leverage their domain knowledge and networks to identify, fund and share the best companies with their partners, as well as to help these companies execute their plans. We\'re enthusiastic supporters of their work!'),

  p('Sophia Amoruso', 'Girlboss, Nasty Gal, Trust Fund', 'LC',
    'Niv is a phenom. As an investor in my last company, he was extremely helpful on all things fundraising, positioning, pitching, and has an incredible network. As a fellow investor, Niv has been beyond generous sending me deals and introducing me to fantastic founders.'),

  p('Brice Gumpel', 'Co-Founder of Seated', 'FC',
    'Niv is one of those investors who adds value far beyond the check that he writes. Whether it\'s introducing you to the lead for your next round, bringing in strong signal strategics to fill out your round, or opening doors to experts in your field, he does it all. His network is unparalleled. Just as importantly, Niv is a great partner to founders. He brings a unique perspective, helps you see opportunities you may have missed, and knows when to give you space when you\'re heads down working through tough problems.'),

  p('Katie Jacobs Stanton', 'Founder of Moxxie Ventures', 'C',
    'Moshe is one of my favorite people to co-invest with! He\'s constantly hustling for the founders he backs doing everything from putting rounds together, strategic introductions that genuinely move the needle for companies, and most importantly acting as a true extension to their team. I\'ve had the pleasure of co-investing with him and Shrug multiple times and can’t recommend working with them enough :)'),

  p('Brian Murray', 'Partner & COO at Craft Ventures, Co-Founder of Cabal', 'F',
    'In the sea of capital, Shrug’s creative helpfulness stands alone. They invest their time and creativity into the companies they back, resulting in memorable and needle-moving contributions to founders. Custom socks, billboards in time square, desktop calendars, and relentless intros are just a few examples of Shrug’s creative helpfulness. We’re lucky to have them backing Cabal.'),

  p('Joshua Steinman', 'Founder of Galvanick', 'F',
    'Moshe is a machine, and I love working with him. Straight to the point. Insane rolodex. Deep understanding of startup world. Loves creative problem solving. He\'s responsive and insightful, and deeply committed to Galvanick\'s success. 10/10.'),

  p('Sung Ho Choi', 'Co-Founder of fuboTV', 'LC',
    'My favorite part about working with Shrug is seeing how happy they are to be doing this job and supporting the entrepreneurs. It’s no wonder people want them on their cap table! They’re always using and testing portco products and dogfooding at every opportunity. When you join Niv’s Popshop Live, he’s wearing Atoms shoes. You’ll see a wall of empty Haus bottles on the side; he’ll be giving away Superplastic toys with Levels patch on his arm and Eight Sleep bed in the background. I’ve bought more products from Shrug’s Community texts than I have from instagram ads. They make the companies they fund part of their own identity. Niv & Moshe have an incredible ability to predict what will be cool next year and have the network to get access to the hottest companies. I feel so fortunate to be along for the ride.'),

  p('Liya Shuster-Bier', 'Founder of Alula', 'F',
    'Moshe is my secret weapon. I met him through Company Ventures early in my pre-seed raise last year. Within 15 minutes of chatting, he had conviction, a rarity. Over the next two weeks, he hustled in every which way possible to help me close the deal early days of the pandemic when most investors were closing shop with the markets in disarray. Over the past 18 months, he has helped bring product and marketing insights from companies that have nothing to do with oncology, like Superhuman, Clubhouse and Haus, to the cancer patient at Alula. His ability to spot early trends, cross-pollinate them and empower founders with insights they hear nowhere else is one-of-a-kind. Oh, and he\'s the realest!'),

  p('Walker Williams', 'Co-Founder of Fourthwall and Teespring', 'FC',
    'Niv and Moshe are amazing. They had early conviction in Fourthwall when almost everyone else thought the idea was crazy and, since investing, they\'ve been fantastic about proactively bringing us opportunities (investor + customer introductions, etc.). Couldn\'t recommend them enough, especially if you\'re doing something big in consumer.'),

  p('Matt Smolin', 'Founder of Hang.xyz', 'F',
    'Moshe and Niv have added as much if not more value than any investor on our cap table. Within days of meeting them, they were all in on Hang and worked with me every single week to help solve our most pressing needs. Their network is unmatched for an early-stage startup looking to raise capital, acquire customers, or get the word out, and when they make a connection, people take notice. We have a variety of great value-add investors, but I am proud to consider them family.'),

  p('Kevin Tan', 'Co-Founder of Snackpass', 'F',
    'Moshe and Niv are lit 🔥 Shrug was one of the few funds Snackpass brought in our Series B, and we were stoked to work with them. Not least because of the strategic people they brought to the table — Steve Paglucia, Dave Grutman, Steve Aoki and many more. If you are looking to add incredibly engaged, connected, and supportive people to your cap table, look no further!'),

  p('Spencer Rascoff', 'Founder of Zillow', 'LC',
    'Niv and Shrug are among the hardest-working folks in venture capital. I can always count on Niv to have his finger on the pulse of the latest trend and to be at the forefront of the intersection between tech and pop culture. Niv’s deal flow is exemplary and I value his judgement greatly.'),

  p('Doug Ludlow', 'Co-Founder of MainStreet', 'F',
    'What more can I say about Niv and Moshe? Shrug was a large participant in our Seed Round, and ever since they\'ve been phenomenal partners, strategists, fundraisers, network builders, and friends. I can confidently state that MainStreet would not be where it is today without Niv, Moshe, and the Shrug network'),

  p('Josh Elman', 'Early PM at most social networks', 'LC',
    'I’ve seen Niv’s work first hand as an operator, advisor, and investor. He makes the best connections. But even more he always has the best advice on how to bring products to life. Storytelling, early customers, how to start the journey. I love sending people to Niv and Shrug because they always come back with more ideas and a better path forward. This is why you want Shrug in your corner.'),

  p('Courtne Smith & Filip Diarra', 'Co-Founders of NewNew', 'F',
    'Shrug is not your typical investor. They genuinely give a shit about helping their portfolio companies succeed — whether it be by making intros, giving advice, guiding you through negotiations, putting together your fundraise, etc. Niv and Moshe have been there for us 24/7 and their support has not gone unnoticed or unappreciated. They’ve backed us multiple times through different rounds and they are the true definition of “value add”. If you’re a founder you need them in your round — if you’re lucky enough to get them.'),

  p('Harry Hurst', 'Co-Founder of Pipe', 'FC',
    'Niv and Moshe are the dream team combo for a founder. Smart, thoughtful and true to their word. I’ve worked with them through multiple rounds now and each and every time it’s been a pleasure. Want to inherit a great network and form real friendships with your investors? Partner with Shrug.'),

  p('Alex Ma', 'Co-Founder of Poparazzi', 'F',
    'Niv understands that the process of building product sometimes takes years and success doesn’t happen overnight. He continued to back us when things got tough / through hype cycles. Having someone in your corner that believes in you through thick and thin goes a long way.'),

  p('Michael Guirguis', 'Co-Founder of Seso', 'F',
    'If you\'re an early stage founder, make it a priority to get Shrug on your captable. While most investors claim to be value-add investors, Moshe really embodies this. He has a founders\' mentality, and an amazing network, and is always making valuable connections for his portfolio companies. I could not endorse Moshe more!'),

  p('Bryant Chou', 'Co-Founder of Webflow', 'LC',
    'Shrug has been the best way for myself to expand beyond the b2b world I know, into various other sectors that I\'d never get access to. They have a great sense for what trends are going to get big, way before it actually does. Their portfolio speaks for itself and the opportunity for myself as an operator/investor to get connected to other exciting companies is unparalleled.'),

  p('Michael Vega-Sanz', 'Co-Founder of Lula', 'F',
    'When Moshe and I first spoke, I mentioned how large the opportunity was at-hand. Previously, several investors had suggested that I think more "realistic" or that I calm my ambitions. Moshe did not bat an eye, and in fact, pushed us to think even bigger. With such large ambitions, we knew that securing a Tier 1 lead for our Series A was imperative. We particularly wanted Founders Fund to lead the round. We sat down with Moshe, and devised the game plan. A few months later, we raised a $19 million Series A that was co-led by Founders Fund and Khosla Ventures. Moshe followed through on their role in the plan, and I am not sure we could have done it without them'),

  p('Matthew Vega-Sanz', 'Co-Founder of Lula', 'F',
    'Most investors tend to over promise, and under deliver. They say they can help in whatever you need, and sell you on this vision of being able to do anything for the founder, and often fall entirely short. Shrug is the opposite and it’s why I love having them on our side. Moshe and Niv make very limited promises, but the few they make are often lofty and absolute game changers. They follow through with absolutely everything they tell you that they\'ll do, because they\'re so aware of where they can be helpful, and only say they\'ll help where they\'re certain they can. Lula will one day be a $100 billion company, and Shrug is one of players that will have played a pivotal role in that accomplishment.'),

  p('Kris Hartvigsen', 'Founder of Dooly', 'F',
    'Moshe is a weapon (for good) for any startup. When we first met Moshe, it was clear that he did his homework and, even before formalizing his investment(s) in Dooly, we were given a clear view into how he operated, and more importantly, how he helped. Moshe’s deep network, his even deeper appreciation for the companies he invests in, and his level of hustle are hard to match. We’ve been fortunate to have him in our corner as it’s led to countless A+ introductions to investors, talent and customers. A true difference maker by any definition and now a true friend.'),

  p('Julia Enthoven', 'Co-Founder of Kapwing', 'F',
    'Niv is extremely proactive. Unlike most investors, he volunteers to help with tactical things, gives us new ideas and actual feedback, and jumps in to advocate for us. He\'s influential, funny, and has a sense of consumer culture that helps him stay on top of trends, brands, and hype. He backchannels for us and helped us close our first round of funding. I\'ve really enjoyed getting to know Niv and working with him since Shrug I.'),

  p('Akshar Bonu', 'Founder of The Custom Movement', 'F',
    'Niv is relentless. While that means he will negotiate aggressively for his fund before the close, once he is on your cap table he will use that drive in your favor and work insanely hard for you. Having met Niv around the time of YC demo day, it felt like I had two YC demo days running concurrently - the official one and the one that is Niv.'),

  p('Tyler Faux', 'Co-Founder of Supergreat', 'F',
    'Niv and Moshe have been fantastic partners to Supergreat from the early days of our company. I\'ve seen firsthand how they work tirelessly for the founders they invest in, making relevant introductions – including to our Series B lead investor. Run, don\'t walk, if you have the chance to work with Shrug.'),

  p('Daniel Mishin', 'Founder of June Homes', 'F',
    'When I think of Shrug, what comes to mind is a moment in time when we were kicking off our Series-A and I felt very uncertain and insecure about how is it going to go, if we will be able to get a lead investor and raise money. Niv and I connected through a common friend and he immediately committed to invest and help close the round. We started speaking every day multiple times a day. Niv was making introductions, reviewing our decks, sharing great fundraising advice but most importantly was there to support me in this process. When we received 3 term sheets from some of the best investors, Niv and I strategized and brainstormed together. As a solo founder I really appreciated him being there for me and the business. Let me make it simple - if you can get Shrug to invest in your startup consider you\'re half way through to your unicorn status.'),

  p('Helena Price Hambrecht', 'Co-Founder of Haus', 'F',
    'Niv began to change our trajectory shortly after I met him. As soon as he joined our cap table he hit the ground running, seeding us to his networks, introducing us to investors and celebrities, and offering sound strategic advice. It\'s hard to quantify how much Shrug has done for us, but I can say it is miles above the average investor.'),

  p('Jake Cahan', 'Founder of Debtsy', 'F',
    'Moshe brings infectious positive energy, a ridiculous number of investor connections, and strategic advice to bear in all of our conversations. He practically single-handedly ran our most recent fundraising process, making countless warm introductions, having (almost daily?) check-ins on our progress, and giving advice on how to improve our narrative. He\'s also just a really, really good person. Including him on our cap table was a no brainer. Whenever a friend is raising, I always send them Moshe’s way.'),

  p('Michael Dubin', 'Founder of Dollar Shave Club', 'LC',
    'Shrug always comes thru with interesting investment opportunities. Some are right down the middle, but many are curveballs which I really like. It\'s often the wildest, zaniest ideas that become the biggest. Shrug is one of the more unique, colorful shops out there and I\'m glad to be an investor'),

  p('JD Maresco', 'Co-Founder of Batch & Citizen', 'F',
    'Niv and Moshe invested in my company very early and became two of my biggest advocates and partners from day one. They introduced close to half of our cap table, including one of our lead investors for our seed round, and were my closest partners in my most recent raise. They invest in products they really believe in and then work hard for their companies, using their incredible network + hype machine to build credibility for the businesses they are involved in. I try to only work with investors who are good people and who hustle and act like founders themselves. Shrug is the real deal.'),

  p('Matthew Dellavedova', 'NBA Champion', 'LC',
    'Niv is a superconnector. As an LP + co-investor, I appreciate the time he takes to explain what he is seeing in early stage investing. The unique brand he has built with Shrug stands out. Really excited that Moshe has joined (LP in his fund previously) and to see what Shrug comes up with next. They are both absolutely relentless in their approach and two people you want on your team!'),

  p('Dom Santry', 'Co-Founder of Daisie', 'F',
    'I was fortunate enough to meet Niv during my first visit to SF. 10 minutes into our first meeting he was making introductions and suggesting ways he could help us w/ our fundraise. He\'s since become one of our most influential investors and a great friend. As many have said, it would be a mistake to pass on any opportunity to have Shrug on your cap table.'),

  p('Galileo Russell', 'HyperChange', 'C',
    'Niv was the reason I got into startup investing. His passion, kindness and quirky fun-ness, make him a legend. But, don’t let the memes fool you, his vision of the future and intuition to find the right founders building it, is second to none. And he’s honest when he needs to be (rare). If I start a company, he will be the first VC I call. Honored to call Niv a friend and mentor, and I owe him more than the bottle of Tesla Tequila I’ve been saving for when we meetup next.'),

  p('Andres Ugarte', 'Co-Founder of Copilot', 'F',
    'Niv is a great partner for product-oriented founders. He understands what makes a product special, and how to create a community around it. He’s extremely proactive, and has the best network in the industry. 10/10, would recommend to a friend.'),

  p('Braden Ream', 'Co-Founder of Voiceflow', 'F',
    'Niv and the Shrug team were instrumental to Voiceflow raising our earliest rounds of funding. Niv coached us through the pitch, helped us refine our story, and ultimately made the introductions that led to True Ventures leading our Seed round. I couldn\'t recommend Shrug more highly as a fantastic partner to early stage founders.'),

  p('Sean Rose', 'Angel Investor', 'LC',
    'Niv and Moshe are two of few investors whose product instincts I trust — they get what\'s cool, what\'s important, and, crucially, what\'s going to be successful. I\'ve invested alongside them over 10 times now and am constantly in awe of their work. They\'re able to build a deep understanding of any industry and business unbelievably quickly and, in turn, how they can be uniquely and exceptionally valuable to each founder. As a fellow investor, I\'ve learned a ton from them and love every opportunity I get to work with them.'),

  p('Linda Xie', 'Founder of Scalar Capital', 'LC',
    'I\'ve been really impressed with Niv and how helpful Shrug has been to founders they invest in. Niv is extremely well-connected and has the ability to spot emerging trends very early on. If Niv is interested in something, I definitely make sure to pay attention.'),

  p('Bilal Abidi', 'Co-Founder of Wise', 'F',
    'We got super lucky to get Niv are Moshe as one of our earliest investors. It\'s incredible how closely they worked with us to run the process, make introductions and even help out with the most trivial things. It is obvious they have an incredible network where they command huge respect. Having Shrug Capital on the cap table is the shortcut to getting oversubscribed for any round.'),

  p('Shara Senderoff', 'President of Raised In Space', 'C',
    'Niv and Moshe have an unmatched tenacity and ambition to keep their finger on the pulse. Their enthusiasm and passion for the ventures they get behind is infectious, but more importantly, their diligence is thorough and strategic. Shrug’s brand and portfolio has true longevity. Grateful to know and invest alongside them.'),

  p('Dennis Xu & Kevin Moody', 'Co-Founders of Mem.ai', 'F',
    'Niv is one of the most proactively helpful investors on our cap table — we go to him anytime we have a question related to distribution/growth/fundraising. He hustled to get into our last round right before it closed and continues to hustle and make relevant introductions to just about anyone we ask for — including some of our most active users. Niv is a walking rolodex that puts his money where his mouth is.'),

  p('Jenny Lefcourt', 'GP at Freestyle Capital', 'LC',
    'Niv & Moshe are two of the most value-add, connected investors I know! VCs like myself work hard to stay close to them as they have access to so many amazing founders/companies. Founders love working with them given their vast network of other founders & VCs and willingness to work hard, 24/7. I am currently an LP in and a co-investor of Shrug\'s and if I were a founder, they would be the first group I would reach out to.'),

  p('Rahul Sengottuvelu', 'Co-Founder of Cohere', 'F',
    'Niv + Shrug have been phenomenal. Niv has the deadly and rare combination of being insanely connected and very easily accessible, which makes him a must-have on your cap table. Getting them in our round was a force multiplier. Also, Shrug operates the valley’s most extensive swag operation, which makes Niv the de facto person to talk to about the right way to do swag, getting distribution, and building hype.'),

  p('Tetsuro Miyatake', 'Co-Founder of Off Topic and Advisor at Harizury', 'LC',
    'NivさんとMosheさんほど業界で繋がりを持っているファンドはいない。投資先のプロダクトを本当に好きなのが話しているだけで伝わるし、これまでのシリコンバレーではいなかった稀有な存在だと思う。"The next big thing will start out looking like a toy."の「おもちゃ」を誰よりも早く見つけ、バリューを提供し、投資先から信頼を得えているトップクラスの投資家です。情報や案件共有するたびに勉強になり、ワクワクさせられます。いつも投資アドバイスをくれる彼らに感謝してます！'),

  p('Alana Anderson', 'Founder of base case capital', 'C',
    'As a new fund manager, Moshe has been one of the most helpful and dependable mentors. Moshe is one of those people that you can text a question and he’ll call you within 5 seconds to answer it in detail. He is truly an open book - whether it’s sharing his fund strategy, investment hypotheses, or LP updates - and is always willing to spend the time to help make others successful. Moshe is truly a “grow the pie” type investor (and human) and I couldn’t be happier to be growing the pie with him.'),

  p('Kelvin Beachum', 'Arizona Cardinals', 'LC',
    'Hustlers, gritty, thoughtful!!! Moshe and Niv have an amazing pulse on what founders need and want!!! Huge believers of their vision and execution.'),

  p('Rus Yusupov', 'Co-Founder of HQ Trivia and Vine', 'FC',
    'I like Niv and Moshe. I like their approach to investing and helping founders. I like investing alongside them and I like collaborating with them. What more can I say?'),

  p('Danielle Li', 'Founder of Popshop Live', 'F',
    'Shrug has an acute understanding of consumer nuances, appreciates the need for being experimental (or playful) at times, and pulls out incredible introductions that are strategic and aligned from their magic hat'),

  p('Arthur Leopold', 'Co-Founder of Cameo', 'FC',
    'Niv and Moshe were early Cameo investors - investing when many hadn\'t yet realized the massive opportunity at hand. From day one, they\'ve been great partners to us as they continuously help open doors, make valuable introductions, and champion our business as we scale. They have also made it easy for founders to invest in highly-competitive rounds. Traditionally, it can be challenging for founders to see a healthy amount of deal flow, but Shrug makes this process simple, and enables founders to bet on each other in a seamless way. We\'re lucky to have Niv and Shrug on the cap table!'),

  p('Maggie Norris', 'Founder of Aidaly', 'F',
    'Moshe was an early believer and helped pull together an amazing syndicate of investors, including an introduction to our lead. Shrug continues to be a trusted sounding board and mentors. I couldn’t recommend better partners at the earliest stage of your journey.'),

  p('Janky', 'Virtual Influencer', '',
    'Thank U Shrug fur believing’ in me even doh I aped your Rolex & stole your girl fam. I luv u SHRUG VENTUREZ'),

]
