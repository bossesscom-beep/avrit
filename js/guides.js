(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AvritGuides = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var AAD_TRIM = "https://www.aad.org/public/everyday-care/nail-care-secrets/basics/how-to-trim-nails";
  var AAD_GEL = "https://www.aad.org/public/everyday-care/nail-care-secrets/basics/pedicures/removing-gel-polish";
  var AAD_SHED = "https://www.aad.org/public/diseases/hair-loss/insider/shedding";
  var AAD_PULL = "https://www.aad.org/public/diseases/hair-loss/causes/hairstyles";
  var AAD_HABIT = "https://www.aad.org/public/everyday-care/hair-scalp-care/hair/habits-that-damage-hair";
  var AAD_WASH = "https://www.aad.org/news/tressed-to-impress-hair-tips";
  var BLUESTAR = "https://consumer.bluestarindia.com/pages/faq";
  var EPA = "https://www.epa.gov/ods-phaseout/homeowners-and-consumers-frequently-asked-questions";
  var AAA = "https://www.aaa.com/autorepair/articles/how-long-do-car-batteries-last";
  var IRDAI_WEB = "https://policyholder.gov.in/motor-insurance";
  var IRDAI_BOOK = "https://irdai.gov.in/documents/37343/993134/Motor%2BInsurance%2BHandbook%2B%28English%29.pdf/44f2a216-f063-9acd-b062-70b6aca97c0f?version=1.0&t=1631528776152";

  function claim(role, text, sourceName, sourceUrl) {
    return { role: role, text: text, sourceName: sourceName, sourceUrl: sourceUrl };
  }

  var GUIDES = [
    {
      id: "nail",
      title: "Nail cut",
      claims: [
        claim("how-to", "Trim after a bath or shower, or after a short soak in lukewarm water, so the nail is soft. Use a nail clipper or nail scissors on fingernails, and a toenail clipper on toenails.", "American Academy of Dermatology", AAD_TRIM),
        claim("how-to", "Cut fingernails almost straight across. Smooth rough edges with a file, moving in one direction only. Filing back and forth weakens the nail.", "American Academy of Dermatology", AAD_TRIM),
        claim("method", "The recommended method is a nearly straight cut, with the corners only slightly rounded so the nail stays strong and does not catch. Cut toenails straight across to lower the chance of an ingrown nail, and leave the cuticle alone.", "American Academy of Dermatology", AAD_TRIM),
        claim("medical", "The cuticle protects the nail root. Cutting or pushing it back makes it easier for bacteria and other germs to get in and cause an infection. A change in nail colour, texture, or shape is a reason to see a dermatologist.", "American Academy of Dermatology", AAD_TRIM),
        claim("surprising", "Dr. Shari Lipner says it takes about six months to grow out a fingernail, and 12 to 18 months to grow out a toenail. She also describes clipping once a week so the free edge does not catch on clothing.", "American Academy of Dermatology", AAD_GEL)
      ]
    },
    {
      id: "haircut",
      title: "Haircut",
      claims: [
        claim("how-to", "Massage shampoo into the scalp. Let the rinse run through the lengths instead of rubbing shampoo into them, and use conditioner after every shampoo.", "American Academy of Dermatology", AAD_HABIT),
        claim("how-to", "Wash when the hair is dirty or oily. Straight hair with an oily scalp may need a daily shampoo. Dry, textured, curly, or thick hair can be washed when needed, at least once every 2 to 3 weeks.", "American Academy of Dermatology", AAD_WASH),
        claim("method", "The recommended method is a loose style after the cut. Tight ponytails, buns, cornrows, braids, and extensions can cause traction alopecia. If the style hurts, it is too tight. Wear braids no longer than 6 to 8 weeks, then give the scalp a break.", "American Academy of Dermatology", AAD_PULL),
        claim("medical", "It is normal to shed between 50 and 100 hairs a day. Shedding well above that is called telogen effluvium. It often follows a high fever, surgery, childbirth, or losing 20 pounds or more, and the extra shed usually settles within six to nine months. A change that worries you belongs with a dermatologist, not with a closer trim.", "American Academy of Dermatology", AAD_SHED),
        claim("surprising", "Hairs on the pillow are often ordinary daily shedding, not proof that the last haircut failed. The Academy separates that shed from hair loss, which is when the hair stops growing until the cause stops.", "American Academy of Dermatology", AAD_SHED)
      ]
    },
    {
      id: "ac",
      title: "AC service",
      claims: [
        claim("practical", "For normal use, Blue Star recommends cleaning the filter once every 15 days. An unclean filter obstructs cooling and can raise energy use by about 10 percent.", "Blue Star", BLUESTAR),
        claim("practical", "Blue Star recommends servicing the air conditioner once every 3 to 4 months for normal use. Avrit's default reminder is a qualified service check at 90 days, inside that spacing.", "Blue Star", BLUESTAR),
        claim("practical", "If the indoor unit will not switch on, or it ignores the remote, Blue Star's FAQ says to contact a Blue Star authorised service centre. Book that visit. This reminder is not a reason to open the refrigerant circuit at home.", "Blue Star", BLUESTAR),
        claim("practical", "In the United States, the Environmental Protection Agency says Section 608 certification is required to recharge stationary air-conditioning appliances, and that refrigerant for those appliances is sold only to certified technicians or the companies that employ them.", "US Environmental Protection Agency", EPA),
        claim("practical", "Blue Star suggests setting the thermostat at a comfortable 25°C. For every degree below 24°C, the same FAQ says the air conditioner uses about 3 to 5 percent more energy.", "Blue Star", BLUESTAR)
      ]
    },
    {
      id: "battery",
      title: "Car battery",
      claims: [
        claim("practical", "AAA says to inspect the battery at every oil change: cable connections clean and tight, hold-down hardware secure. Once a battery reaches its third year, have it tested annually. Avrit's default is that yearly workshop test.", "AAA", AAA),
        claim("practical", "A car battery test is how you see the level of deterioration before the car simply will not start. Warning signs AAA lists include a starter that cranks slowly and a battery or charging lamp on the dash.", "AAA", AAA),
        claim("practical", "Letting a car battery go completely dead takes a big chunk out of its life, even if it is later recharged and put back in service. Avrit's date is a workshop test, not a home charging session.", "AAA", AAA),
        claim("practical", "Replace a battery with the same type the car left the factory with. AAA says an incorrect battery can affect the electrical system, and misplaced terminals can cause a short and major damage.", "AAA", AAA)
      ]
    },
    {
      id: "insurance",
      title: "Insurance renewal",
      claims: [
        claim("practical", "IRDAI's motor insurance handbook says a policy is usually valid for one year and has to be renewed before the due date. Pay the premium on time. No insurer offers a grace period. A lapse of even one day can mean the vehicle has to be inspected.", "IRDAI", IRDAI_BOOK),
        claim("practical", "The IRDAI policyholder page says you should approach the insurance company at least 15 days before the existing policy period ends.", "IRDAI", IRDAI_WEB),
        claim("practical", "Own-damage cover on a new private car or new two-wheeler bundled policy is for one year. Third-party cover on a new private car can be three years, and on a new two-wheeler five years. Renew the date printed on your policy. If it is longer than a year, set that interval in Avrit.", "IRDAI", IRDAI_WEB),
        claim("practical", "If a comprehensive motor policy lapses for more than 90 days, the handbook says the accrued no-claim bonus is lost as well. Avrit's default reminder is the following annual date so the renewal stays ahead of the due date.", "IRDAI", IRDAI_BOOK)
      ]
    },
    {
      id: "custom",
      title: "Custom item",
      claims: [
        claim("practical", "For an item you add yourself, Avrit reminds you after the number of days you save. If you leave the interval empty, the first suggestion is 30 days, and you can replace it.", "Avrit", "https://bighelpers.in/avrit/")
      ]
    }
  ];

  function getGuide(id) {
    for (var i = 0; i < GUIDES.length; i += 1) {
      if (GUIDES[i].id === id) return GUIDES[i];
    }
    return null;
  }

  function allClaims() {
    var list = [];
    GUIDES.forEach(function (guide) {
      guide.claims.forEach(function (entry) {
        list.push({
          guideId: guide.id,
          role: entry.role,
          text: entry.text,
          sourceName: entry.sourceName,
          sourceUrl: entry.sourceUrl
        });
      });
    });
    return list;
  }

  return { GUIDES: GUIDES, getGuide: getGuide, allClaims: allClaims };
});
