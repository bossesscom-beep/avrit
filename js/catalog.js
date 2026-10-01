(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AvritCatalog = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var groups = [
    { id: 'self', name: 'Personal care', icon: '✂', color: '#E7DDF9', caption: 'Feel a little more like you.' },
    { id: 'home', name: 'A happier home', icon: '⌂', color: '#DDF0BA', caption: 'Fresh corners. A lighter mind.' },
    { id: 'wardrobe', name: 'Clothes & belongings', icon: '♧', color: '#FFDCCB', caption: 'Care for what you already have.' },
    { id: 'health', name: 'Health appointments', icon: '♡', color: '#F9DCE7', caption: 'Keep your agreed care dates close.' },
    { id: 'digital', name: 'Digital life', icon: '⌘', color: '#D8EAFB', caption: 'Less clutter, more breathing room.' },
    { id: 'admin', name: 'Life admin', icon: '✳', color: '#FFE8AF', caption: 'The occasional things that slip away.' }
  ];
  // These are editable planning ideas, not hygiene, medical or service standards.
  var rows = [
    ['haircut','self','✂','Hair cutting','That fresh-cut feeling. Again.','Keep your next trim from becoming a someday. Choose a gap that fits your hair and style.',42,[28,42,56],'Book a slot, save a reference photo, or simply give yourself time for a trim.'],
    ['nail','self','✋','Nail cutting','Small detail. Fresh start.','A little reminder to check and trim your nails when they need it.',7,[7,10,14],'Keep your own tools ready. Adjust the rhythm to how quickly your nails grow.'],
    ['massage','self','☁','Body massage','Make room to unwind.','A moment you choose for comfort and relaxation, at home or with a professional.',30,[14,30,60],'Think of this as time for yourself. Choose what feels comfortable for you.'],
    ['hair-tools','self','〰','Clean hair tools','A reset for your everyday tools.','Give your combs, brushes and grooming tools their own small care window.',14,[7,14,30],'Gather the tools you actually use and follow their cleaning instructions.'],
    ['grooming','self','✧','Grooming refresh','Your style, your ritual.','Beard care, a shave, a trim, or another grooming ritual you want to make time for.',7,[3,7,14],'Everyone gets the same choices here. Keep only the rituals that are yours.'],
    ['bathroom','home','◒','Bathroom cleaning','A fresh little sanctuary.','Make space for a bathroom reset before it becomes a whole weekend project.',7,[7,14,21],'Pick a manageable scope: basin, mirror, surfaces and floor. Split big jobs into separate Avrits.'],
    ['shelves','home','▤','Shelf cleaning','Clear shelf. Clear head.','Dust, put things back, and rediscover a little space on your shelves.',14,[7,14,30],'Start with one shelf. Keep, relocate, or set aside what no longer belongs.'],
    ['bedding','home','▱','Wash bed linen','The fresh-sheets moment.','Keep a recurring place for washing and changing your bed linen.',7,[7,14,21],'Choose a laundry day that works for you and check fabric care labels.'],
    ['fridge','home','▣','Fridge reset','Make room for the good stuff.','A small reset to check what is inside, organise shelves and plan a clean.',14,[7,14,30],'Take a quick inventory before your next grocery shop.'],
    ['kitchen','home','◴','Kitchen deep clean','One corner at a time.','Set aside a little time for the kitchen areas beyond everyday washing up.',30,[14,30,60],'Choose one zone, such as the hob, cabinets or sink area.'],
    ['ac-filter','home','❋','AC filter check','Remember the hidden bits.','Make a date to check the care instructions and condition of your AC filter.',30,[30,60,90],'Use your appliance manual to decide what to clean or have serviced.'],
    ['shoes','wardrobe','♧','Shoe cleaning','A fresh pair of steps.','Give your everyday shoes a clean and a little attention.',14,[7,14,30],'Check the material and care label before choosing a cleaning method.'],
    ['old-clothes','wardrobe','↗','Sell or donate old clothes','A little less. A little lighter.','Revisit clothes you no longer wear and decide what to sell, donate or recycle.',90,[30,90,180],'Try five pieces at a time. Take listing photos and make a small, finishable plan.'],
    ['wardrobe-reset','wardrobe','▥','Wardrobe reset','Find your favourites again.','Fold, organise and make your everyday clothes easy to reach.',30,[14,30,90],'Organise for the way you get dressed, not for a perfect photograph.'],
    ['bags','wardrobe','▢','Bag & wallet clean-out','Carry a little less.','Empty out old receipts, tidy compartments and care for the bag you use most.',30,[14,30,60],'Check pockets first and follow the material care instructions.'],
    ['repairs','wardrobe','⌁','Clothing repairs','Keep the favourites going.','Make time for loose buttons, small repairs and pieces waiting for a tailor.',60,[30,60,90],'Keep a small repair pile, then book or finish one job.'],
    ['eye-checkup','health','◎','Eye checkup','Keep your next visit in sight.','Remember an eye appointment on the schedule you agree with your eye-care professional.',null,[],'Enter the repeat interval recommended for you. Avrit does not choose a medical schedule.'],
    ['dental-checkup','health','◇','Dental checkup','A place for your next visit.','Keep track of a dental review using your dentist’s recommended timing.',null,[],'Use the interval from your dentist. You can set the first appointment date in the timing options.'],
    ['health-review','health','♡','Health review','Keep your care plan close.','Remember a follow-up or review already discussed with your clinician.',null,[],'Use your care plan for timing. This card is a reminder, not a screening recommendation.'],
    ['phone-clean','digital','▯','Phone & keyboard cleaning','Freshen up your daily tools.','A recurring moment to care for the devices you touch and use.',14,[7,14,30],'Follow the maker’s instructions for your device and accessories.'],
    ['photo-backup','digital','▧','Photo backup check','Keep the memories close.','Check that the photos you care about are backed up where you intended.',30,[7,30,90],'Open your chosen backup service and confirm recent photos are there.'],
    ['digital-declutter','digital','⌘','Digital declutter','A little more space.','Sort downloads, unused apps and files that have been waiting for attention.',30,[14,30,90],'Start with one folder or one device. Review before deleting anything.'],
    ['subscriptions','digital','↻','Subscription review','Still using it?','Revisit recurring subscriptions and decide which ones still fit your life.',90,[30,90,180],'Review the next billing dates and terms before making changes.'],
    ['documents','admin','▤','Document check','Find it when you need it.','Keep important documents organised and note upcoming expiry dates.',90,[30,90,180],'Check the actual dates on your documents. Make a separate reminder for each deadline.'],
    ['vehicle','admin','◉','Vehicle care','A little care for the journey.','Remember to check your vehicle’s service schedule and arrange the next visit.',90,[30,90,180],'Set timing from the manual or service centre, including mileage where relevant.'],
    ['home-service','admin','⌂','Home maintenance check','Care for the bigger things.','Make time to review filters, appliances or repairs around your home.',90,[30,90,180],'Choose one item and follow its service instructions. Use a professional where needed.'],
    ['money-admin','admin','▦','Monthly admin reset','Clear the little loose ends.','Set aside a moment for receipts, pending forms and household paperwork.',30,[14,30,60],'Bring your open tasks together and choose what to finish next.'],
    ['connections','admin','☏','Catch up with someone','Make time for your people.','A gentle nudge to plan a call or a visit you have been meaning to make.',30,[7,14,30],'Choose a rhythm that feels warm and natural, and give this Avrit their name later.']
  ];
  var items = rows.map(function (r) { return { id: r[0], category: r[1], icon: r[2], title: r[3], headline: r[4], description: r[5], days: r[6], options: r[7], tip: r[8] }; });
  return { groups: groups, items: items, get: function (id) { return items.find(function (i) { return i.id === id; }); }, group: function (id) { return groups.find(function (g) { return g.id === id; }); } };
});
