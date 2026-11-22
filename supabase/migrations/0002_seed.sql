-- Seed data. Spa prices come from the printed menu in the shop.
-- Salon prices are PLACEHOLDERS — edit them in Admin → Services.

insert into admin_emails (email) values ('purplespasalon23@gmail.com') on conflict do nothing;
update profiles set role = 'admin' where email in (select email from admin_emails);

insert into service_categories (slug, kind, name_en, name_hi, description_en, description_hi, sort) values
  ('massage', 'spa', 'Massage Therapies', 'मसाज थेरेपी', 'Full sessions, chosen by the pressure you like.', 'पूरा सेशन, आपकी पसंद के दबाव के अनुसार।', 1),
  ('spa-rituals', 'spa', 'Spa Rituals', 'स्पा रिचुअल्स', 'Scrubs, gels and focused therapies.', 'स्क्रब, जेल और ख़ास थेरेपी।', 2),
  ('combos', 'spa', 'Combos', 'कॉम्बो', 'Longer rituals at a better price.', 'लंबे रिचुअल, बेहतर दाम में।', 3),
  ('hair', 'salon', 'Hair', 'हेयर', null, null, 4),
  ('skin', 'salon', 'Skin & Face', 'स्किन और फेस', null, null, 5),
  ('hands-feet', 'salon', 'Hands, Feet & Waxing', 'हाथ, पैर और वैक्सिंग', null, null, 6)
on conflict (slug) do nothing;

-- helper to insert a service with variants: (category slug, slug, en, hi, tag_en, tag_hi, resource, sort, [[min, price], ...])
create or replace function pg_temp.svc(c text, sl text, en text, hi text, ten text, thi text, res resource_kind, so int, v int[][])
returns void language plpgsql as $$
declare sid uuid; i int;
begin
  insert into services (category_id, slug, name_en, name_hi, tag_en, tag_hi, resource, sort)
  values ((select id from service_categories where slug = c), sl, en, hi, ten, thi, res, so)
  on conflict (slug) do nothing returning id into sid;
  if sid is null then return; end if;
  for i in 1 .. array_length(v, 1) loop
    insert into service_variants (service_id, duration_min, price) values (sid, v[i][1], v[i][2]);
  end loop;
end $$;

select pg_temp.svc('massage', 'lomi-lomi', 'Lomi Lomi Massage', 'लोमी लोमी मसाज', 'Light pressure', 'हल्का दबाव', 'bed', 1, array[[60,1200],[90,2200]]);
select pg_temp.svc('massage', 'swedish', 'Swedish Massage', 'स्वीडिश मसाज', 'Medium pressure', 'मध्यम दबाव', 'bed', 2, array[[60,1500],[90,2500]]);
select pg_temp.svc('massage', 'aroma', 'Aroma Massage', 'अरोमा मसाज', 'Medium pressure', 'मध्यम दबाव', 'bed', 3, array[[60,1500],[90,2500]]);
select pg_temp.svc('massage', 'balinese', 'Balinese Massage', 'बालिनीज़ मसाज', 'Medium pressure', 'मध्यम दबाव', 'bed', 4, array[[60,1500],[90,2500]]);
select pg_temp.svc('massage', 'deep-tissue', 'Deep Tissue Massage', 'डीप टिशू मसाज', 'Hard pressure', 'गहरा दबाव', 'bed', 5, array[[60,1800],[90,3000]]);

select pg_temp.svc('spa-rituals', 'aroma-scrub', 'Aroma Scrub', 'अरोमा स्क्रब', 'Body scrub', 'बॉडी स्क्रब', 'bed', 1, array[[30,1200]]);
select pg_temp.svc('spa-rituals', 'onion-scrub', 'Onion Scrub', 'अनियन स्क्रब', 'Body scrub', 'बॉडी स्क्रब', 'bed', 2, array[[30,1500]]);
select pg_temp.svc('spa-rituals', 'charcoal-scrub', 'Charcoal Scrub', 'चारकोल स्क्रब', 'Body scrub', 'बॉडी स्क्रब', 'bed', 3, array[[30,2000]]);
select pg_temp.svc('spa-rituals', 'foot-reflexology', 'Foot Reflexology', 'फुट रिफ्लेक्सोलॉजी', null, null, 'bed', 4, array[[30,1000]]);
select pg_temp.svc('spa-rituals', 'neck-back', 'Neck & Back Massage', 'गर्दन और पीठ की मसाज', null, null, 'bed', 5, array[[30,1000]]);
select pg_temp.svc('spa-rituals', 'ayurvedic-oil', 'Ayurvedic Oil Massage', 'आयुर्वेदिक तेल मसाज', null, null, 'bed', 6, array[[45,1800],[90,3000]]);
select pg_temp.svc('spa-rituals', 'chocolate-gel', 'Chocolate Gel Massage', 'चॉकलेट जेल मसाज', null, null, 'bed', 7, array[[45,1800]]);
select pg_temp.svc('spa-rituals', 'aloe-vera-gel', 'Aloe Vera Gel Massage', 'एलोवेरा जेल मसाज', null, null, 'bed', 8, array[[45,2000]]);
select pg_temp.svc('spa-rituals', 'red-wine', 'Red Wine Therapy', 'रेड वाइन थेरेपी', null, null, 'bed', 9, array[[45,2500]]);

-- Waxing and D-Tan durations were not printed on the menu; 60 min is a placeholder.
select pg_temp.svc('combos', 'spa-facial', 'Spa & Facial', 'स्पा और फेशियल', null, null, 'bed', 1, array[[90,2000]]);
select pg_temp.svc('combos', 'body-polishing', 'Body Polishing', 'बॉडी पॉलिशिंग', null, null, 'bed', 2, array[[120,3000]]);
select pg_temp.svc('combos', 'spa-scrub', 'Spa & Scrub', 'स्पा और स्क्रब', null, null, 'bed', 3, array[[90,2500]]);
select pg_temp.svc('combos', 'full-body-waxing', 'Full Body Waxing', 'फुल बॉडी वैक्सिंग', null, null, 'bed', 4, array[[60,3000]]);
select pg_temp.svc('combos', 'full-body-dtan', 'Full Body D-Tan', 'फुल बॉडी डी-टैन', null, null, 'bed', 5, array[[60,3000]]);

-- Salon (placeholder prices)
select pg_temp.svc('hair', 'haircut-men', 'Haircut — Men', 'हेयरकट — पुरुष', null, null, 'chair', 1, array[[30,300]]);
select pg_temp.svc('hair', 'haircut-women', 'Haircut — Women', 'हेयरकट — महिला', null, null, 'chair', 2, array[[45,600]]);
select pg_temp.svc('hair', 'beard', 'Beard Shaping', 'दाढ़ी शेपिंग', null, null, 'chair', 3, array[[20,200]]);
select pg_temp.svc('hair', 'head-massage', 'Head Massage', 'हेड मसाज', null, null, 'chair', 4, array[[30,500]]);
select pg_temp.svc('hair', 'hair-spa', 'Hair Spa', 'हेयर स्पा', null, null, 'chair', 5, array[[60,1200]]);
select pg_temp.svc('hair', 'global-colour', 'Global Hair Colour', 'ग्लोबल हेयर कलर', null, null, 'chair', 6, array[[120,2500]]);
select pg_temp.svc('hair', 'keratin', 'Keratin Treatment', 'केराटिन ट्रीटमेंट', null, null, 'chair', 7, array[[180,4500]]);
select pg_temp.svc('skin', 'cleanup', 'Face Clean-up', 'फेस क्लीन-अप', null, null, 'chair', 1, array[[30,800]]);
select pg_temp.svc('skin', 'facial', 'Signature Facial', 'सिग्नेचर फेशियल', null, null, 'chair', 2, array[[60,1500]]);
select pg_temp.svc('skin', 'detan-face', 'Face & Neck D-Tan', 'फेस और नेक डी-टैन', null, null, 'chair', 3, array[[30,700]]);
select pg_temp.svc('skin', 'threading', 'Eyebrow Threading', 'आइब्रो थ्रेडिंग', null, null, 'chair', 4, array[[10,50]]);
select pg_temp.svc('hands-feet', 'manicure', 'Manicure', 'मैनीक्योर', null, null, 'chair', 1, array[[40,600]]);
select pg_temp.svc('hands-feet', 'pedicure', 'Pedicure', 'पेडीक्योर', null, null, 'chair', 2, array[[50,800]]);
select pg_temp.svc('hands-feet', 'wax-arms', 'Waxing — Full Arms', 'वैक्सिंग — पूरे हाथ', null, null, 'chair', 3, array[[20,400]]);
select pg_temp.svc('hands-feet', 'wax-legs', 'Waxing — Full Legs', 'वैक्सिंग — पूरे पैर', null, null, 'chair', 4, array[[30,600]]);
