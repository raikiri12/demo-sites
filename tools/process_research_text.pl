use strict;
use warnings;
use utf8;
use JSON::PP;

my @slugs = (
    'shino-master', 'greenbell', 'zhanetta', 'yanacvetok', 'webstar',
    'vetvi', 'vagservice', 'tvoybuket', 'tutprolubov', 'toylex',
    'tm-motors', 'teamavto', 'storiscvety', 'stolichny', 'stebelyok',
    'starter102', 'sisters', 'shaman', 'set100', 'servisplus'
);

my $summaries = {
    'shino-master' => {
        review_points => ['Быстрое и качественное обслуживание', 'Отсутствие очередей', 'Компетентные и ответственные мастера', 'Доступные цены'],
        complaints => []
    },
    greenbell => {
        review_points => ['Оперативная доставка букетов в другие города', 'Свежие и красивые цветы', 'Приятные цены', 'Внимательный персонал и флорист'],
        complaints => ['Некоторые покупатели жалуются, что розы быстро вянут', 'Претензии по качеству цветов не всегда принимаются']
    },
    zhanetta => {
        review_points => ['Большой выбор цветов в просторном холодильнике', 'Приятный и профессиональный персонал', 'Демократичные цены', 'Экзотические цветы и необычные сочетания', 'Дают советы по уходу за букетом'],
        complaints => ['Встречаются замечания к упаковке и свежести отдельных цветов']
    },
    yanacvetok => {
        review_points => ['Потрясающие цветы и композиции', 'Удобное удалённое согласование заказа', 'Быстрая сборка и доставка', 'Присылают фото букета перед отправкой', 'Внимательный и вежливый персонал'],
        complaints => []
    },
    webstar => {
        review_points => ['Грамотный подход к сложному ремонту', 'Цены обсуждаются и не меняются после работ', 'Запчасти привозят оперативно', 'Не навязывают лишних услуг', 'Адекватные цены и квалифицированные специалисты'],
        complaints => []
    },
    vetvi => {
        review_points => ['Высокий уровень обслуживания', 'Тщательная и удобная упаковка букетов', 'Свежие и долго стоящие цветы', 'Приемлемые цены', 'Надёжная доставка'],
        complaints => []
    },
    vagservice => {
        review_points => ['Сложный ремонт выполняют очень быстро', 'Профессиональная диагностика и прошивка', 'Рекомендуют владельцам VAG', 'Качество работы и обслуживания на высоком уровне'],
        complaints => ['По мнению одного клиента, ремонт прокладки ГБЦ оказался неполным при высокой стоимости']
    },
    tvoybuket => {
        review_points => ['Свежие цветы, которые долго стоят', 'Вежливые флористы и хороший сервис', 'Разумные цены и помощь с выбором', 'Удобная доставка', 'Оригинальные и красивые композиции'],
        complaints => ['Отдельные покупатели остаются не впечатлены букетом']
    },
    tutprolubov => {
        review_points => ['Красивые и свежие букеты по приемлемым ценам', 'Приветливый и вежливый персонал', 'Цветы долго стоят', 'Уютное оформление магазина', 'Быстрая сборка композиций'],
        complaints => []
    },
    toylex => {
        review_points => ['Быстрая и профессиональная диагностика', 'Оперативно устраняют неисправности', 'Дружелюбный персонал', 'Предоставляют гарантию на работу'],
        complaints => []
    },
    'tm-motors' => {
        review_points => ['Качественно выполняют ТО и ремонт', 'Не навязывают лишних деталей', 'Мастера вежливые и всё объясняют', 'Быстрое выполнение работ', 'Двигатель работает заметно лучше'],
        complaints => []
    },
    teamavto => {
        review_points => ['Быстрый и аккуратный шиномонтаж', 'Приятные цены без скрытых доплат', 'Скидки постоянным клиентам', 'Запись по времени без очереди', 'Порядочные и вежливые мастера'],
        complaints => []
    },
    storiscvety => {
        review_points => ['Приятный и отзывчивый персонал', 'Свежие и красивые цветы', 'Доступные цены', 'Быстрое обслуживание'],
        complaints => []
    },
    stolichny => {
        review_points => ['Профессиональная диагностика VAG, Porsche и Mercedes', 'Решают сложные проблемы, с которыми не справились другие', 'Быстрый и качественный ремонт', 'Адекватные итоговые цены', 'Продуманный сервис от диагностики до подбора запчастей'],
        complaints => ['Шиномонтаж и балансировку колёс большого радиуса не всегда выполняют качественно']
    },
    stebelyok => {
        review_points => ['Недорогие и красивые цветы', 'Добрый и отзывчивый продавец', 'Уютная студия с широким ассортиментом', 'Свежие букеты долго стоят', 'Помогают подобрать подходящий букет'],
        complaints => []
    },
    starter102 => {
        review_points => ['Специализация на ремонте стартеров и генераторов', 'Запчасти в наличии', 'Нормальные цены', 'Быстрый и качественный ремонт', 'Мастер подробно объясняет причины неисправности'],
        complaints => []
    },
    sisters => {
        review_points => ['Уютная цветочная лавка', 'Быстро и качественно собирают букеты', 'Удобная доставка точно ко времени', 'Шары и цветы в одном месте', 'Свежие цветы и красивые букеты'],
        complaints => []
    },
    shaman => {
        review_points => ['Быстрый и качественный ремонт двигателя', 'Запчасти быстро подбирают и доставляют', 'Мастера знают своё дело', 'Решают сложные проблемы с ходовой частью'],
        complaints => []
    },
    set100 => {
        review_points => ['Удобная запись на шиномонтаж без очередей', 'Предлагают сезонное хранение колёс', 'Аккуратная работа с контролем момента затяжки и балансировкой', 'Свой магазин запчастей', 'Квалифицированные и вежливые специалисты'],
        complaints => []
    },
    servisplus => {
        review_points => ['Качественное развал-схождение', 'Мастер предупреждает о будущих заменах', 'Ведут историю обращений клиента', 'Адекватные цены', 'Можно записаться в день обращения'],
        complaints => []
    }
};

my @tracked = qw(email services prices payment amenities review_points complaints review_summary);

sub is_empty {
    my ($v) = @_;
    return 1 unless defined $v;
    return 1 if ref($v) eq 'ARRAY' && @$v == 0;
    return 1 if !ref($v) && "$v" eq '';
    return 0;
}

sub json_escape {
    my ($s) = @_;
    $s =~ s/\\/\\\\/g;
    $s =~ s/"/\\"/g;
    $s =~ s/\n/\\n/g;
    $s =~ s/\r/\\r/g;
    $s =~ s/\t/\\t/g;
    return $s;
}

sub format_array_value {
    my ($key, $items) = @_;
    if (!@$items) {
        return qq{  "$key": []};
    }
    my $out = qq{  "$key": [\n};
    $out .= join(",\n", map { qq{    "} . json_escape($_) . qq{"} } @$items) . "\n";
    $out .= qq{  ]};
    return $out;
}

sub missing_line {
    my ($data) = @_;
    my @missing;
    for my $field (@tracked) {
        push @missing, $field if exists $data->{$field} && is_empty($data->{$field});
    }
    push @missing, 'photos' if ($data->{photos_count} // -1) == 0;
    @missing = sort @missing;
    return qq{  "missing": [} . join(',', map { qq{"$_"} } @missing) . qq{]};
}

my $json = JSON::PP->new->utf8;

my @rows;
for my $slug (@slugs) {
    my $file = "data/research/$slug.json";
    open my $in, '<:encoding(UTF-8)', $file or die "Cannot read $file: $!";
    local $/;
    my $text = <$in>;
    close $in;

    my $data = $json->decode($text);
    my $summary = $summaries->{$slug};

    # update review_points and complaints values for missing calculation
    $data->{review_points} = $summary->{review_points};
    $data->{complaints} = $summary->{complaints};

    # remove reviews_raw block
    $text =~ s/\n  "reviews_raw"\s*:\s*\[[^\]]*?\],\n(?=\s*"photos_count")/\n/s;

    # replace review_points and complaints arrays
    my $rp_re = qr/  "review_points"\s*:\s*\[\],/;
    my $cm_re = qr/  "complaints"\s*:\s*\[\],/;
    $text =~ s/$rp_re/format_array_value('review_points', $summary->{review_points})/e;
    $text =~ s/$cm_re/format_array_value('complaints', $summary->{complaints})/e;

    # replace missing line
    my $miss_re = qr/  "missing"\s*:\s*\[[^\]]*\],/;
    $text =~ s/$miss_re/missing_line($data)/e;

    open my $out, '>:encoding(UTF-8)', $file or die "Cannot write $file: $!";
    print $out $text;
    close $out;

    push @rows, [$slug, scalar(@{$summary->{review_points}}), @{$summary->{complaints}} ? 'да' : 'нет'];
}

print "| slug | review_points count | complaints (да/нет) |\n";
print "|---|---|---|\n";
for my $row (@rows) {
    print "| $row->[0] | $row->[1] | $row->[2] |\n";
}
