// Chet Valentine's scripted lines for routine events (GDD "Hybrid narrator
// spec"): at least 5 variants each, never the same one twice in a row.
// {vars} are filled from the event. These play in the neon strip on the map;
// battle lines live in battleText.

export type HostEvent =
  | 'runStart'
  | 'enemyAlerted'
  | 'itemPicked'
  | 'tokensGained'
  | 'hazardHurt'
  | 'lowHp'
  | 'fightWon'
  | 'fightFled'
  | 'captiveSpotted'
  | 'allyRecruited'
  | 'allyDied'
  | 'allyQuit'
  | 'allyStole'
  | 'allyTurned'
  | 'loyaltyLow'
  | 'levelUp'
  | 'bribeShort'
  | 'ateGood'
  | 'ateBad'
  | 'doorOpened'
  | 'skillUp';

export const HOST_LINES: Record<HostEvent, string[]> = {
  skillUp: [
    '{skill} level {level}! Our contestant is learning! Slowly! Painfully!',
    'Look who\'s paying attention, folks! {skill}, level {level}!',
    '{skill} goes up to {level}! Knowledge is power! Power is not armour, though!',
    'Level {level} in {skill}! You can see it coming now! Dodging it is a separate course!',
    '{skill} is now level {level}! Our contestant has been taking notes! On their own injuries!',
  ],
  runStart: [
    'Welcome to DESCEND & WIN! The show where the only way out is down! Our {class} looks... available!',
    'Folks, give it up for our newest contestant, a {race} {class} with absolutely no idea where they are!',
    'It\'s a brand new episode of DESCEND & WIN! Let\'s see how long THIS one lasts!',
    'Contestant, welcome to the Intake Sewers! Mind the floor. Mind the walls. Mind, generally.',
    'Here we go, folks! One {class}, one sewer, zero guarantees. I LOVE this job!',
  ],
  enemyAlerted: [
    'Ooh, the {enemy} has seen you! Act natural!',
    'Heads up, contestant! That {enemy} looks like it wants an autograph. With its teeth.',
    'The {enemy} has spotted you! Somebody\'s getting a visit!',
    'Uh-oh! A {enemy} with a plan! Well, with an appetite.',
    'And the {enemy} is on the move, folks! Run, or don\'t! Either way, great TV!',
  ],
  itemPicked: [
    'A {item}! What a prize! I mean that legally, not emotionally.',
    'The contestant picks up a {item}! Treasure it! It is worth exactly what you paid.',
    'Ooh, a {item}! Somebody at home just screamed. Probably for other reasons.',
    'Into the pockets goes the {item}! Use it wisely, or, more realistically, at all!',
    'A {item}, folks! Straight from our prize department, which is a bin.',
  ],
  tokensGained: [
    'Cha-ching! Prize Tokens! Don\'t spend them all on medical care!',
    '{amount} tokens for the contestant! That is almost enough for something!',
    'Ka-CHING! {amount} Prize Tokens! Folks, they\'re rich! Relatively! Down here!',
    'Look at that, {amount} shiny tokens! Legal tender in this sewer and nowhere else!',
    '{amount} Prize Tokens! The economy down here is thriving, by which I mean it exists!',
  ],
  hazardHurt: [
    'Ooh, the {hazard}! That\'s a classic! A classic way to get hurt!',
    'The contestant finds the {hazard} the hard way! Is there another way? No!',
    'Folks, the {hazard} claims another victim! Not fully! Yet!',
    'Somebody tell our contestant the {hazard} is not a shortcut! Too late!',
    'The {hazard} strikes! The contestant reacts! We all learn something!',
  ],
  lowHp: [
    'Folks, our contestant is down to {hp} HP and still going! Commitment!',
    '{hp} HP left! This is the part where the music gets tense!',
    'Look at that health bar, folks! Mostly bar, very little health!',
    'Contestant, you are at {hp} HP! I would say "be careful", but where\'s the fun?',
    'Only {hp} HP! The folks at home are leaning in! Some are taking bets!',
  ],
  fightWon: [
    'And THAT is how we do it on DESCEND & WIN!',
    'Another fight in the books! Several books! All of them gory!',
    'The contestant stands victorious! Mostly upright, anyway!',
    'What a show! Somebody get the cleaning crew. Then pay them. Then don\'t.',
    'Victory! The judges award full marks for enthusiasm and partial marks for technique!',
  ],
  fightFled: [
    'Our contestant runs! And the residents? They\'re not done with you, folks!',
    'A tactical retreat! Which is French for "running away"!',
    'They\'re out! Brave, brave, sort of brave contestant!',
    'Leaving so soon? They\'ll come looking. They always do!',
    'Contestant flees the scene! Nobody saw it! Except everyone!',
  ],
  captiveSpotted: [
    'Ooh, a contestant profile, folks! {profile}',
    'Who\'s that? Let\'s check the card! {profile}',
    'Look who it is! {profile}',
    'A potential teammate, folks! {profile}',
    'Contestant, meet a new friend! Maybe! {profile}',
  ],
  allyRecruited: [
    'Welcome to the family, {ally}! The family has a very high turnover rate!',
    '{ally} joins the party! Let\'s give them a big hand while they still have both!',
    'And {ally} is on the team! Folks, this is what we call "a liability"!',
    'It\'s official! {ally} is with you now! In sickness and in mostly sickness!',
    '{ally} signs on! No contract, no benefits, no refunds!',
  ],
  allyDied: [
    '{ally}, ELIMINATED! Their lovely parting gift: a {item}, which they\'d want you to have!',
    'We lost {ally}, folks! A moment of silence! That\'s enough! They dropped a {item}!',
    'Farewell, {ally}! You were a real team player! The team mostly played you! Grab their {item}!',
    '{ally} is out of the game! Permanently! They left a {item} and a lot of questions!',
    'Oh no, {ally}! Taken from us too soon, or right on schedule! Their {item} is up for grabs!',
  ],
  allyQuit: [
    '{ally} has stopped accepting your insurance! And just like that, they\'re gone!',
    'And {ally} walks off the set! Contract disputes, folks! Nobody had a contract!',
    '{ally} quits! Said something about "a toxic workplace"! In a SEWER!',
    'Ooh, {ally} has had enough! Can\'t imagine why! I can, actually!',
    '{ally} is out of here! Not eliminated! Just disappointed! Which is worse!',
  ],
  allyStole: [
    '{ally} has left the building, folks! And so has your {item}!',
    'Ooh! {ally} takes the {item} and runs! The coward with a gun is now a coward with a {item}!',
    '{ally} is GONE! Check your pockets! Yep, the {item} is gone too!',
    'And {ally} makes a break for it with your {item}! You have to respect the hustle!',
    '{ally} walks off with the {item}! Mostly runs! Definitely steals!',
  ],
  allyTurned: [
    '{ally} has filed a grievance! And the grievance is YOU!',
    'Oh-ho! {ally} is switching sides, folks! Watch your back! Specifically your spine!',
    '{ally} has turned on the contestant! Loyalty! What a concept! Was!',
    'Folks, {ally} is coming for you now! That\'s what we call a plot twist!',
    '{ally} has had it with you! Run, contestant! Or apologise! Running is better!',
  ],
  loyaltyLow: [
    'Ooh, {ally} is giving you a LOOK, folks. I\'ve seen that look. Usually right before a lawsuit!',
    'Is it me, or is {ally} sulking? Maybe share something, contestant! Just a thought!',
    '{ally} seems unhappy! Folks, I sense a storyline!',
    'Trouble in paradise! {ally} is muttering! Muttering is never good!',
    '{ally} hasn\'t laughed at one of your jokes in a while, contestant. Just saying!',
  ],
  levelUp: [
    'LEVEL {level}! Look at you, growing! Like a mould!',
    'The contestant reaches level {level}! Somebody get them a cake! Not a real one!',
    'Level {level}, folks! Our contestant is now slightly harder to kill!',
    'Ding! Level {level}! That\'s the sound of improvement, or a microwave!',
    'Level {level}! The judges are impressed! The judges are easily impressed!',
  ],
  bribeShort: [
    '{ally} wants {price} tokens, contestant! You\'ve got {tokens}! Math is cruel!',
    'Ooh, short of cash! {ally} doesn\'t do pro bono, folks! {price} tokens!',
    '{price} tokens for {ally}, and our contestant has {tokens}! Come back richer!',
    'No tokens, no {ally}! That\'s showbiz! You need {price}!',
    '{ally} checks your wallet and laughs! {price} tokens, please! You have {tokens}!',
  ],
  ateGood: [
    'The contestant eats the remains and feels GREAT! Folks, I am going to be sick!',
    'Mmm! Waste not, want not! Heal not? Heal yes!',
    'A Gutterfolk snack! The folks at home are changing the channel!',
    'Look at that appetite! And look at that health bar go UP!',
    'Delicious, apparently! Our contestant\'s doctor would be horrified! They don\'t have one!',
  ],
  ateBad: [
    'The contestant eats the remains! And regrets it! Instantly!',
    'Ooh, that went down badly! And it wants to come back up!',
    'That was a choice, folks! A bad choice! But a choice!',
    'The contestant just ate WHAT? Folks, I\'m legally required to say "don\'t try this at home"!',
    'Not everyone can eat that, contestant! You have now learned this!',
  ],
  doorOpened: [
    'A door! What\'s behind it? Probably teeth!',
    'The contestant opens a door! Bold! Possibly fatal!',
    'Knock knock! Who\'s there? Hopefully nothing! Probably something!',
    'Another door, folks! The suspense! The smell!',
    'Open sesame! Close sesame, if you\'re smart!',
  ],
};

/** Fewer lines for chatty events: the chance a routine event gets a line at all. */
export const HOST_CHANCE: Partial<Record<HostEvent, number>> = { doorOpened: 0.25, enemyAlerted: 0.6 };

/** How long a line stays up on the map strip, in milliseconds. */
export const HOST_LINE_MS = 6500;
