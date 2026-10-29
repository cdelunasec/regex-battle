-- GENERATED FILE. Edit src/data/challenges.ts and run `npm run seed:sql`.
--
-- Starting challenge bank: 18 regex challenges.
-- Keyed on slug so re-running this migration updates the bank in place.

insert into public.problems
  (slug, language, prompt, difficulty, match_mode, must_match, must_not_match)
values
  ('gato-pato-rato', 'regex', 'Captura exactamente las palabras gato, pato y rato. Ninguna otra palabra de cuatro letras debe pasar.', 1, 'full', '["gato","pato","rato"]'::jsonb, '["dato","gata","gatos","ato"]'::jsonb),
  ('digitos-sueltos', 'regex', 'Encuentra cualquier grupo de uno o más dígitos dentro del texto.', 1, 'partial', '["abc123","7","el año 2026","x9y"]'::jsonb, '["sin numeros aqui","hola mundo","---"]'::jsonb),
  ('palabra-capitalizada', 'regex', 'Captura palabras que empiezan con una letra mayúscula y siguen en minúsculas, de principio a fin.', 1, 'full', '["Luna","Santo","Regex"]'::jsonb, '["luna","LUNA","3Luna","Luna23"]'::jsonb),
  ('tres-minusculas', 'regex', 'Captura palabras de exactamente tres letras minúsculas, ni una más ni una menos.', 1, 'full', '["gol","pan","sol","luz"]'::jsonb, '["Gol","gols","go","g0l"]'::jsonb),
  ('termina-en-punto', 'regex', 'Encuentra las frases que terminan en punto. El punto tiene que ser el último carácter.', 2, 'partial', '["Hola mundo.","Esto termina bien.","El fin."]'::jsonb, '["Hola mundo","Esto no termina","Punto . en medio"]'::jsonb),
  ('correos-com', 'regex', 'Captura todos los correos que terminen en .com.', 2, 'full', '["luna@itla.edu.com","test@gmail.com","a@b.com"]'::jsonb, '["luna@itla.edu.do","textoplano","@com","test@gmail.como"]'::jsonb),
  ('fecha-dd-mm-aaaa', 'regex', 'Captura fechas escritas como dd/mm/aaaa, con dos dígitos de día, dos de mes y cuatro de año.', 2, 'full', '["01/01/2026","25/12/1999","09/08/2024"]'::jsonb, '["1/1/2026","2026-01-01","25/12/99","aa/bb/cccc"]'::jsonb),
  ('color-hexadecimal', 'regex', 'Captura códigos de color hexadecimales, o sea una almohadilla seguida de tres o seis dígitos hexadecimales.', 2, 'full', '["#fff","#000000","#a1b2c3","#ABCDEF"]'::jsonb, '["fff","#ggg","#12345","#1234567"]'::jsonb),
  ('telefono-dominicano', 'regex', 'Captura teléfonos dominicanos con formato 809-555-1234. Los únicos códigos válidos son 809, 829 y 849.', 2, 'full', '["809-555-1234","829-123-4567","849-000-1111"]'::jsonb, '["800-555-1234","8095551234","809-55-1234","859-555-1234"]'::jsonb),
  ('palabras-sin-e', 'regex', 'Captura palabras en minúscula que no contengan la letra e por ninguna parte.', 3, 'full', '["gato","luna","carro","pato"]'::jsonb, '["perro","este","mesa","tren"]'::jsonb),
  ('archivos-de-imagen', 'regex', 'Captura nombres de archivo de imagen, o sea los que terminan en .jpg, .png o .gif.', 3, 'full', '["foto.jpg","imagen1.png","mi-gif.gif","logo.png"]'::jsonb, '["documento.pdf","foto.jpeg","archivo.txt",".jpg"]'::jsonb),
  ('ipv4', 'regex', 'Captura direcciones IPv4, cuatro grupos de uno a tres dígitos separados por puntos.', 3, 'full', '["192.168.1.1","10.0.0.1","255.255.255.255","8.8.8.8"]'::jsonb, '["192.168.1","1.2.3.4.5","192.168.1.abc","192,168,1,1"]'::jsonb),
  ('etiqueta-html-apertura', 'regex', 'Encuentra etiquetas HTML de apertura dentro del texto. Las de cierre, las que llevan barra, no cuentan.', 3, 'partial', '["<div>","<p class=\"x\">","texto <span> aqui"]'::jsonb, '["</div>","div>","< p >"]'::jsonb),
  ('palabra-duplicada', 'regex', 'Encuentra una palabra que aparece dos veces seguidas, separada solo por un espacio. Vas a necesitar una referencia hacia atrás.', 3, 'partial', '["el el gato","hola hola","esto es es una prueba"]'::jsonb, '["el gato","hola mundo","es esa"]'::jsonb),
  ('password-fuerte', 'regex', 'Captura contraseñas de al menos ocho caracteres, solo letras y dígitos, que tengan por lo menos una mayúscula y por lo menos un dígito.', 4, 'full', '["Password1","Abcdef12","Luna2026x"]'::jsonb, '["password1","PASSWORD","Abc1","abcdefgh"]'::jsonb),
  ('comentario-de-linea', 'regex', 'Encuentra comentarios de una línea que empiezan con doble barra. Ojo, las dos barras de una URL no son un comentario.', 4, 'partial', '["// esto es un comentario","let x = 1; // suma","//"]'::jsonb, '["let x = 1;","http://ejemplo.com","/ solo una barra"]'::jsonb),
  ('error-sin-warning', 'regex', 'Encuentra las líneas de log que contienen la palabra error pero no contienen la palabra warning.', 4, 'partial', '["error: fallo","hay un error aqui","error"]'::jsonb, '["warning: cuidado","error y warning juntos","todo bien"]'::jsonb),
  ('decimal-con-miles', 'regex', 'Captura números con separador de miles por coma y decimales opcionales por punto, como 1,234.56 o 999.', 5, 'full', '["1,234.56","999","1,000","12,345,678.9"]'::jsonb, '["1234.56","1,23,456",",123","1,2345"]'::jsonb)
on conflict (slug) do update set
  language       = excluded.language,
  prompt         = excluded.prompt,
  difficulty     = excluded.difficulty,
  match_mode     = excluded.match_mode,
  must_match     = excluded.must_match,
  must_not_match = excluded.must_not_match,
  is_active      = true;